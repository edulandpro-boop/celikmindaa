import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { deliverPaidPdfOrder } from "@/lib/email-delivery";
import { Bayarcash } from "bayarcash-ts-sdk";

export const runtime = "nodejs";

async function readCallbackData(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  const data: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    const json = await request.json();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      for (const [key, value] of Object.entries(json)) {
        if (value !== undefined && value !== null) data[key] = String(value);
      }
    }
    return data;
  }

  const form = await request.formData();
  form.forEach((value, key) => { data[key] = String(value); });
  return data;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.BAYARCASH_API_SECRET_KEY;
    const token = process.env.BAYARCASH_API_TOKEN;
    if (!secret || !token) {
      console.error("Bayarcash callback: missing gateway configuration.");
      return new NextResponse("Missing gateway configuration", { status: 500 });
    }

    const data = await readCallbackData(request);
    const bayarcash = new Bayarcash(token, {
      sandbox: process.env.BAYARCASH_SANDBOX !== "false",
      apiVersion: "v3",
    });

    const valid = bayarcash.verifyTransactionCallbackData(data as never, secret);
    if (!valid) return new NextResponse("Invalid checksum", { status: 400 });

    const orderNumber = String(data.order_number || "").trim();
    const status = String(data.status || "");
    if (!orderNumber) return new NextResponse("Missing order number", { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: order, error: findError } = await supabase
      .from("celik_minda_orders")
      .select("id,order_number,customer_name,customer_email,payment_status,order_status,delivery_email_status,total_sen")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (findError) {
      console.error("Order lookup failed:", findError.message);
      return new NextResponse("Order lookup failed", { status: 500 });
    }
    if (!order) return new NextResponse("Order not found", { status: 404 });

    // Bayarcash status 3 = successful. Verify amount as an additional safeguard when supplied.
    if (status === "3") {
      const callbackAmount = data.amount;
      if (callbackAmount !== undefined && callbackAmount !== "") {
        const parsedAmount = Number(callbackAmount);
        const expectedAmount = Number(order.total_sen) / 100;
        if (!Number.isFinite(parsedAmount) || Math.abs(parsedAmount - expectedAmount) > 0.009) {
          console.error("Callback amount mismatch for order", orderNumber);
          return new NextResponse("Payment amount mismatch", { status: 400 });
        }
      }

      if (order.payment_status !== "paid") {
        const { error: updateError } = await supabase
          .from("celik_minda_orders")
          .update({ payment_status: "paid", order_status: "confirmed" })
          .eq("id", order.id);
        if (updateError) {
          console.error("Order payment update failed:", updateError.message);
          return new NextResponse("Database update failed", { status: 500 });
        }
      }

      const deliveryStatus = String(order.delivery_email_status || "pending");
      if (deliveryStatus === "sent" || deliveryStatus === "not_required") {
        return NextResponse.json({ received: true });
      }

      // Claim delivery to reduce duplicate emails if Bayarcash retries the callback.
      const { data: claimed, error: claimError } = await supabase
        .from("celik_minda_orders")
        .update({ delivery_email_status: "sending" })
        .eq("id", order.id)
        .in("delivery_email_status", ["pending", "failed"])
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error("Delivery claim failed:", claimError.message);
        return new NextResponse("Delivery claim failed", { status: 500 });
      }

      if (claimed) {
        try {
          const result = await deliverPaidPdfOrder({
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name || "Pelanggan",
            customer_email: order.customer_email,
          });

          if (result.sent) {
            const { error: sentError } = await supabase
              .from("celik_minda_orders")
              .update({ delivery_email_status: "sent", delivery_email_sent_at: new Date().toISOString() })
              .eq("id", order.id)
              .eq("delivery_email_status", "sending");
            if (sentError) throw new Error(`Could not mark email sent: ${sentError.message}`);
          }
          // For hardcopy-only orders, helper marks status as not_required.
        } catch (deliveryError) {
          console.error("Automatic PDF delivery failed:", deliveryError instanceof Error ? deliveryError.message : "Unknown error");
          await supabase.from("celik_minda_orders")
            .update({ delivery_email_status: "failed" })
            .eq("id", order.id)
            .eq("delivery_email_status", "sending");
          return new NextResponse("Payment confirmed; email delivery failed and needs retry", { status: 500 });
        }
      }
    } else if (["2", "4", "5"].includes(status)) {
      // Never overwrite a successful payment if an older callback arrives later.
      await supabase.from("celik_minda_orders")
        .update({ payment_status: "failed", order_status: "cancelled" })
        .eq("order_number", orderNumber)
        .eq("payment_status", "pending");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Bayarcash callback error:", error instanceof Error ? error.message : "Unknown error");
    return new NextResponse("Callback processing failed", { status: 500 });
  }
}
