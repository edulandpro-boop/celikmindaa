import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("celik_minda_products")
    .select("id,sku,name,age_group,format,price_sen,includes_postage,description")
    .eq("active", true)
    .order("price_sen", { ascending: true });

  if (error) {
    console.error("Product query failed:", error.message);
    return NextResponse.json({ error: "Produk tidak dapat dimuatkan." }, { status: 500 });
  }
  const products = (data ?? []).map((p) => ({
    id: p.id, sku: p.sku, name: p.name, target_age: p.age_group,
    format: String(p.format).toLowerCase() === "pdf" ? "PDF" : "Hardcopy", price: Number(p.price_sen) / 100,
    includes_postage: p.includes_postage, description: p.description,
  }));
  return NextResponse.json({ products });
}
