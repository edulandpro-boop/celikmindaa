
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { deliverPaidPdfOrder } from "@/lib/email-delivery";
import { Bayarcash } from "bayarcash-ts-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secret = process.env.BAYARCASH_API_SECRET_KEY;
    const token = process.env.BAYARCASH_API_TOKEN;

    if (!secret || !token) {
      return new NextResponse("Missing gateway configuration", {
        status: 500,
      });
    }

    const form = await request.formData();
    const data: Record<string, string> = {};

    form.forEach((value, key) => {
      data[key] = String(value);
    });

    const sandbox = process.env.BAYARCASH_SANDBOX !== "false";
    const bayarcash = new Bayarcash(token, {
      sandbox,
      apiVersion: "v3",
    });

    const valid = bayarcash.verifyTransactionCallbackData(
      data as never,
      secret,
    );

    if (!valid) {
      return new NextResponse("Invalid checksum", { status: 400 });
    }

    const orderNumber = data.order_number;
    const status = String(data.status ?? "");

    if (!orderNumber) {
      return new NextResponse("Missing order number", { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (status === "3") {
      const { data: order, error } = await supabase
        .from("celik_minda_orders")
        .select(
          "id, order_number, customer_name, email, payment_status, delivery_email_status",
        )
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (error) {
        console.error("Order lookup failed:", error.message);
        return new NextResponse("Order lookup failed", { status: 500 });
      }

      if (!order) {
        return new NextResponse("Order not found", { status: 404 });
      }

      if (order.payment_status !== "paid") {
        const { error: updateError } = await supabase
          .from("celik_minda_orders")
          .update({
            payment_status: "paid",
            order_status: "confirmed",
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Payment update failed:", updateError.message);
          return new NextResponse("Database update failed", {
            status: 500,
          });
        }
      }

      const currentEmailStatus = String(
        order.delivery_email_status || "pending",
      );

      if (["pending", "failed"].includes(currentEmailStatus)) {
        const { data: claimed, error: claimError } = await supabase
          .from("celik_minda_orders")
          .update({ delivery_email_status: "sending" })
          .eq("id", order.id)
          .in("delivery_email_status", ["pending", "failed"])
          .select("id")
          .maybeSingle();

        if (claimError) {
          console.error("Email claim failed:", claimError.message);
          return new NextResponse("Email claim failed", { status: 500 });
        }

        if (claimed) {
          try {
            await deliverPaidPdfOrder(order);

            const { error: sentError } = await supabase
              .from("celik_minda_orders")
              .update({
                delivery_email_status: "sent",
                delivery_email_sent_at: new Date().toISOString(),
              })
              .eq("id", order.id)
              .eq("delivery_email_status", "sending");

            if (sentError) {
              console.error("Email status update failed:", sentError.message);
              return new NextResponse("Email sent; status update failed", {
                status: 500,
              });
            }
          } catch (emailError) {
            console.error(
              "Customer email failed:",
              emailError instanceof Error
                ? emailError.message
                : "Unknown error",
            );

            await supabase
              .from("celik_minda_orders")
              .update({ delivery_email_status: "failed" })
              .eq("id", order.id)
              .eq("delivery_email_status", "sending");

            return new NextResponse(
              "Payment confirmed; email delivery failed",
              { status: 500 },
            );
          }
        }
      }
    } else if (["2", "4", "5"].includes(status)) {
      const { error } = await supabase
        .from("celik_minda_orders")
        .update({
          payment_status: "failed",
          order_status: "cancelled",
        })
        .eq("order_number", orderNumber)
        .eq("payment_status", "pending");

      if (error) {
        console.error("Failed payment update failed:", error.message);
        return new NextResponse("Database update failed", { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "Bayarcash callback error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return new NextResponse("Callback processing failed", { status: 500 });
  }
}
