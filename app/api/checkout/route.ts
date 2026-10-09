import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

function clean(value: unknown, max = 250) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const sku = clean(body.sku, 30);
    const customerName = clean(body.customerName, 150);
    const phone = clean(body.phone, 30);
    const email = clean(body.email, 250);
    const address = clean(body.address, 500);
    const postcode = clean(body.postcode, 12);
    const city = clean(body.city, 100);
    const state = clean(body.state, 100);

    if (!sku || !customerName || !phone) {
      return NextResponse.json({ error: "Sila isi nama, nombor telefon dan produk." }, { status: 400 });
    }
    const { data: product, error: productError } = await supabaseAdmin
      .from("celik_minda_products")
      .select("id,sku,name,age_group,format,price_sen,includes_postage,active")
      .eq("sku", sku)
      .eq("active", true)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Produk tidak dijumpai atau tidak aktif." }, { status: 404 });
    }
    if (String(product.format).toLowerCase() === "hardcopy" && (!address || !postcode || !city || !state)) {
      return NextResponse.json({ error: "Untuk hardcopy, sila isi alamat penuh, poskod, bandar dan negeri." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Sila masukkan alamat e-mel yang sah untuk rekod pembayaran." }, { status: 400 });
    }

    const amount = Number(product.price_sen) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Harga produk tidak sah." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("celik_minda_orders")
      .insert({
        customer_name: customerName,
        phone,
        email,
        delivery_address: address || null,
        postcode: postcode || null,
        city: city || null,
        state: state || null,
        payment_method: "ONLINE",
        payment_status: "pending",
        order_status: "pending",
        subtotal: amount,
        postage_fee: 0,
        total_amount: amount,
      })
      .select("id,order_number,total_amount")
      .single();

    if (orderError || !order) {
      console.error("Order insert failed:", orderError?.message);
      return NextResponse.json({ error: "Pesanan tidak berjaya disimpan. Cuba lagi." }, { status: 500 });
    }

    const { error: itemError } = await supabaseAdmin.from("celik_minda_order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: `${product.name} (${product.age_group})`,
      format: product.format,
      quantity: 1,
      unit_price: amount,
    });

    if (itemError) {
      console.error("Order item insert failed:", itemError.message);
      await supabaseAdmin.from("celik_minda_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Butiran pesanan tidak berjaya disimpan." }, { status: 500 });
    }

    const token = process.env.BAYARCASH_API_TOKEN;
    const secret = process.env.BAYARCASH_API_SECRET_KEY;
    const portalKey = process.env.BAYARCASH_PORTAL_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!token || !secret || !portalKey || !siteUrl) {
      console.error("Bayarcash environment variables are missing.");
      return NextResponse.json({ error: "Bayaran belum dikonfigurasi. Sila hubungi pentadbir." }, { status: 500 });
    }

    const sandbox = process.env.BAYARCASH_SANDBOX !== "false";
    const bayarcash = new Bayarcash(token, { sandbox, apiVersion: "v3" });
    const paymentData = {
      portal_key: portalKey,
      payment_channel: PaymentChannel.FPX,
      order_number: String(order.order_number).slice(0, 30),
      amount: Number(amount.toFixed(2)),
      payer_name: customerName,
      payer_email: email,
      payer_telephone_number: phone,
      return_url: `${siteUrl.replace(/\/$/, "")}/payment/return`,
      callback_url: `${siteUrl.replace(/\/$/, "")}/api/bayarcash/callback`,
    };
    const checksum = bayarcash.createPaymentIntentChecksumValue(secret, paymentData);
    const payment = await bayarcash.createPaymentIntent({ ...paymentData, checksum });

    if (!payment?.url) {
      console.error("Bayarcash response did not include a checkout URL.");
      return NextResponse.json({ error: "Pautan pembayaran tidak diterima. Cuba lagi." }, { status: 502 });
    }

    return NextResponse.json({ checkoutUrl: payment.url, orderNumber: order.order_number });
  } catch (error) {
    console.error("Checkout error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Tidak dapat memulakan pembayaran. Sila cuba lagi." }, { status: 500 });
  }
}
