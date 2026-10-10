import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Bayarcash, PaymentChannel } from "bayarcash-ts-sdk";

export const runtime = "nodejs";

type CheckoutBody = {
  sku?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  postcode?: string;
  city?: string;
  state?: string;
};

function clean(value: unknown, max = 250): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let orderId: string | null = null;

  try {
    let body: CheckoutBody;
    try {
      body = (await request.json()) as CheckoutBody;
    } catch {
      return NextResponse.json({ error: "Maklumat tempahan tidak sah." }, { status: 400 });
    }

    const sku = clean(body.sku, 30);
    const customerName = clean(body.customerName, 150);
    const phone = clean(body.phone, 30);
    const email = clean(body.email, 250).toLowerCase();
    const address = clean(body.address, 500);
    const postcode = clean(body.postcode, 12);
    const city = clean(body.city, 100);
    const state = clean(body.state, 100);

    if (!sku || !customerName || !phone) {
      return NextResponse.json({ error: "Sila isi nama, nombor telefon dan produk." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Sila masukkan alamat e-mel yang sah." }, { status: 400 });
    }

    const token = process.env.BAYARCASH_API_TOKEN;
    const secret = process.env.BAYARCASH_API_SECRET_KEY;
    const portalKey = process.env.BAYARCASH_PORTAL_KEY;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")).replace(/\/$/, "");

    if (!token || !secret || !portalKey || !siteUrl) {
      return NextResponse.json({ error: "Bayaran belum dikonfigurasi. Semak tetapan Bayarcash dan NEXT_PUBLIC_SITE_URL di Vercel." }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    const { data: product, error: productError } = await supabase
      .from("celik_minda_products")
      .select("id,sku,name,age_group,format,price_sen,includes_postage,active")
      .eq("sku", sku)
      .eq("active", true)
      .single();

    if (productError || !product) {
      console.error("Product lookup failed:", productError?.message);
      return NextResponse.json({ error: "Produk tidak dijumpai atau tidak aktif." }, { status: 404 });
    }

    const format = String(product.format || "").toLowerCase();
    const isHardcopy = format === "hardcopy";
    if (isHardcopy && (!address || !postcode || !city || !state)) {
      return NextResponse.json({ error: "Untuk hardcopy, sila isi alamat penuh, poskod, bandar dan negeri." }, { status: 400 });
    }

    const totalSen = Number(product.price_sen);
    if (!Number.isSafeInteger(totalSen) || totalSen <= 0) {
      console.error("Invalid product price_sen:", product.price_sen);
      return NextResponse.json({ error: "Harga produk tidak sah. Sila hubungi pentadbir." }, { status: 500 });
    }

    const orderNumber = `CM-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const orderInsert = {
      order_number: orderNumber,
      customer_name: customerName,
      customer_email: email,
      customer_phone: phone,
      shipping_address: address || null,
      postcode: postcode || null,
      city: city || null,
      state: state || null,
      payment_method: "FPX",
      payment_status: "pending",
      order_status: "pending",
      subtotal_sen: totalSen,
      postage_sen: 0,
      total_sen: totalSen,
    };

    const { data: order, error: orderError } = await supabase
      .from("celik_minda_orders")
      .insert(orderInsert)
      .select("id,order_number,total_sen")
      .single();

    if (orderError || !order) {
      console.error("Order insert failed:", orderError?.message);
      return NextResponse.json({ error: "Pesanan tidak berjaya disimpan.", details: orderError?.message || "Supabase tidak memulangkan butiran ralat." }, { status: 500 });
    }
    orderId = String(order.id);

    // Match the actual celik_minda_order_items schema: prices are stored in sen.
    const { error: itemError } = await supabase.from("celik_minda_order_items").insert({
      order_id: order.id,
      product_id: product.id ?? null,
      sku: String(product.sku),
      product_name: `${product.name} (${product.age_group})`,
      format: String(product.format),
      quantity: 1,
      unit_price_sen: totalSen,
      line_total_sen: totalSen,
    });

    if (itemError) {
      console.error("Order item insert failed:", itemError.message, itemError.details, itemError.hint);
      // Remove the pending order so a failed checkout does not leave an orphan order.
      await supabase.from("celik_minda_orders").delete().eq("id", order.id);
      return NextResponse.json({
        error: "Butiran produk gagal disimpan.",
        details: itemError.message,
        hint: itemError.hint || undefined,
      }, { status: 500 });
    }

    const amount = Number((totalSen / 100).toFixed(2));
    const paymentData = {
      portal_key: portalKey,
      payment_channel: PaymentChannel.FPX,
      order_number: String(order.order_number).slice(0, 30),
      amount,
      payer_name: customerName,
      payer_email: email,
      payer_telephone_number: phone,
      return_url: `${siteUrl}/payment/return`,
      callback_url: `${siteUrl}/api/bayarcash/callback`,
    };

    try {
      const bayarcash = new Bayarcash(token, {
        sandbox: process.env.BAYARCASH_SANDBOX !== "false",
        apiVersion: "v3",
      });
      const checksum = bayarcash.createPaymentIntentChecksumValue(secret, paymentData);
      const payment = await bayarcash.createPaymentIntent({ ...paymentData, checksum });

      if (!payment?.url) {
        await supabase.from("celik_minda_orders")
          .update({ payment_status: "failed", order_status: "cancelled" })
          .eq("id", order.id)
          .eq("payment_status", "pending");
        return NextResponse.json({ error: "Bayarcash tidak memulangkan pautan pembayaran. Cuba lagi." }, { status: 502 });
      }

      return NextResponse.json({ checkoutUrl: payment.url, orderNumber: order.order_number });
    } catch (gatewayError) {
      await supabase.from("celik_minda_orders")
        .update({ payment_status: "failed", order_status: "cancelled" })
        .eq("id", order.id)
        .eq("payment_status", "pending");
      throw gatewayError;
    }
  } catch (error) {
    console.error("Checkout error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Tidak dapat memulakan pembayaran. Sila cuba lagi." }, { status: 500 });
  }
}
