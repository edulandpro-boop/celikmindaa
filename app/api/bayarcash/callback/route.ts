
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deliverPaidPdfOrder } from "@/lib/email-delivery";
import { Bayarcash } from "bayarcash-ts-sdk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = process.env.BAYARCASH_API_TOKEN;
    const secretKey = process.env.BAYARCASH_API_SECRET_KEY;

    if (!token || !secretKey) {
      console.error("Bayarcash credentials are missing.");
      return NextResponse.json(
        { error: "Payment configuration is incomplete." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const callbackData: Record<string, string> = {};

    formData.forEach((value, key) => {
      callbackData[key] = String(value);
    });

    // Support JSON callbacks as well.
    if (Object.keys(callbackData).length === 0) {
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const jsonData = await request.json();
        Object.entries(jsonData).forEach(([key, value]) => {
          callbackData[key] = String(value ?? "");
        });
      }
    }

    const bayarcash = new Bayarcash(token, {
      sandbox: process.env.BAYARCASH_SANDBOX === "true",
      apiVersion: "v3",
    });

    const isValid = bayarcash.verifyTransactionCallbackData(
      callbackData,
      secretKey
    );

    if (!isValid) {
      console.error("Bayarcash callback checksum verification failed.");
      return NextResponse.json(
        { error: "Invalid callback checksum." },
        { status: 400 }
      );
    }

    const orderNumber = callbackData.order_number;
    const status = String(callbackData.status ?? "");

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Missing order number." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("celik_minda_orders")
      .select("*")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup failed:", orderError.message);
      return NextResponse.json(
        { error: "Unable to find order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // Only status 3 means payment successful.
    if (status === "3") {
      if (order.payment_status === "paid") {
        return NextResponse.json({ received: true });
      }

      const { error: updateError } = await supabaseAdmin
        .from("celik_minda_orders")
        .update({
          payment_status: "paid",
          order_status: "confirmed",
        })
        .eq("order_number", orderNumber);

      if (updateError) {
        console.error("Order update failed:", updateError.message);
        return NextResponse.json(
          { error: "Unable to update order." },
          { status: 500 }
        );
      }

      const { data: existingDelivery, error: deliveryLookupError } =
        await supabaseAdmin
          .from("celik_minda_email_deliveries")
          .select("*")
          .eq("order_number", orderNumber)
          .maybeSingle();

      if (deliveryLookupError) {
        console.error(
          "Email delivery lookup failed:",
          deliveryLookupError.message
        );
        return NextResponse.json(
          { error: "Unable to check email delivery." },
          { status: 500 }
        );
      }

      if (existingDelivery?.status === "sent") {
        return NextResponse.json({ received: true });
      }

      if (existingDelivery?.status === "sending") {
        return NextResponse.json({ received: true });
      }

      if (existingDelivery) {
        const { error: claimError } = await supabaseAdmin
          .from("celik_minda_email_deliveries")
          .update({
            status: "sending",
            error_message: null,
          })
          .eq("order_number", orderNumber);

        if (claimError) {
          console.error("Email delivery claim failed:", claimError.message);
          return NextResponse.json(
            { error: "Unable to prepare email delivery." },
            { status: 500 }
          );
        }
      } else {
        const { error: createDeliveryError } = await supabaseAdmin
          .from("celik_minda_email_deliveries")
          .insert({
            order_number: orderNumber,
            status: "sending",
          });

        if (createDeliveryError) {
          console.error(
            "Email delivery record creation failed:",
            createDeliveryError.message
          );
          return NextResponse.json(
            { error: "Unable to prepare email delivery." },
            { status: 500 }
          );
        }
      }

      try {
        await deliverPaidPdfOrder(order);

        const { error: sentError } = await supabaseAdmin
          .from("celik_minda_email_deliveries")
          .update({
            status: "sent",
            error_message: null,
          })
          .eq("order_number", orderNumber);

        if (sentError) {
          console.error("Email status update failed:", sentError.message);
          return NextResponse.json(
            { error: "Email sent but delivery status update failed." },
            { status: 500 }
          );
        }

        const { error: orderEmailError } = await supabaseAdmin
          .from("celik_minda_orders")
          .update({ delivery_email_sent_at: new Date().toISOString() })
          .eq("order_number", orderNumber);

        if (orderEmailError) {
          console.error(
            "Order email timestamp update failed:",
            orderEmailError.message
          );
        }
      } catch (emailError) {
        const message =
          emailError instanceof Error
            ? emailError.message
            : "Unknown email delivery error";

        console.error("PDF email delivery failed:", message);

        await supabaseAdmin
          .from("celik_minda_email_deliveries")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("order_number", orderNumber);

        return NextResponse.json(
          { error: "Payment received, but PDF email delivery failed." },
          { status: 500 }
        );
      }

      return NextResponse.json({ received: true });
    }

    // Final unsuccessful, cancelled, or expired statuses.
    if (["2", "4", "5"].includes(status)) {
      const { error: failedUpdateError } = await supabaseAdmin
        .from("celik_minda_orders")
        .update({
          payment_status: "failed",
          order_status: "cancelled",
        })
        .eq("order_number", orderNumber)
        .neq("payment_status", "paid");

      if (failedUpdateError) {
        console.error(
          "Failed payment status update:",
          failedUpdateError.message
        );
        return NextResponse.json(
          { error: "Unable to update payment status." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Bayarcash callback error:", error);

    return NextResponse.json(
      { error: "Unable to process payment callback." },
      { status: 500 }
    );
  }
}
    );

    if (!valid) {
      console.error("Bayarcash callback checksum validation failed.");
      return new NextResponse("Invalid checksum", { status: 400 });
    }

    const orderNumber = data.order_number;
    const status = String(data.status ?? "");

    if (!orderNumber) {
      return new NextResponse("Missing order number", { status: 400 });
    }

    if (status === "3") {
      const { data: order, error: findError } = await supabaseAdmin
        .from("celik_minda_orders")
        .select(
          "id, order_number, customer_name, email, payment_status, delivery_email_status"
        )
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (findError) {
        console.error("Order lookup failed:", findError.message);
        return new NextResponse("Order lookup failed", { status: 500 });
      }

      if (!order) {
        console.error("Order not found:", orderNumber);
        return new NextResponse("Order not found", { status: 404 });
      }

      if (order.payment_status !== "paid") {
        const { error: updateError } = await supabaseAdmin
          .from("celik_minda_orders")
          .update({
            payment_status: "paid",
            order_status: "confirmed",
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Order payment update failed:", updateError.message);
          return new NextResponse("Database update failed", {
            status: 500,
          });
        }
      }

      const deliveryStatus = String(
        order.delivery_email_status || "pending"
      );

      if (["pending", "failed"].includes(deliveryStatus)) {
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from("celik_minda_orders")
          .update({ delivery_email_status: "sending" })
          .eq("id", order.id)
          .in("delivery_email_status", ["pending", "failed"])
          .select("id")
          .maybeSingle();

        if (claimError) {
          console.error("Delivery claim failed:", claimError.message);
          return new NextResponse("Delivery claim failed", {
            status: 500,
          });
        }

        if (claimed) {
          try {
            await deliverPaidPdfOrder(order);

            const { error: deliveryUpdateError } = await supabaseAdmin
              .from("celik_minda_orders")
              .update({
                delivery_email_status: "sent",
                delivery_email_sent_at: new Date().toISOString(),
              })
              .eq("id", order.id)
              .eq("delivery_email_status", "sending");

            if (deliveryUpdateError) {
              console.error(
                "Delivery status update failed:",
                deliveryUpdateError.message
              );
              return new NextResponse("Delivery status update failed", {
                status: 500,
              });
            }
          } catch (deliveryError) {
            console.error(
              "Automatic PDF delivery failed:",
              deliveryError instanceof Error
                ? deliveryError.message
                : "Unknown error"
            );

            await supabaseAdmin
              .from("celik_minda_orders")
              .update({ delivery_email_status: "failed" })
              .eq("id", order.id)
              .eq("delivery_email_status", "sending");

            return new NextResponse(
              "Payment confirmed; email delivery failed and needs retry",
              { status: 500 }
            );
          }
        }
      }
    } else if (["2", "4", "5"].includes(status)) {
      const { error: failedUpdateError } = await supabaseAdmin
        .from("celik_minda_orders")
        .update({
          payment_status: "failed",
          order_status: "cancelled",
        })
        .eq("order_number", orderNumber)
        .eq("payment_status", "pending");

      if (failedUpdateError) {
        console.error(
          "Failed payment update error:",
          failedUpdateError.message
        );
        return new NextResponse("Database update failed", { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "Bayarcash callback error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return new NextResponse("Callback processing failed", { status: 500 });
  }
}
