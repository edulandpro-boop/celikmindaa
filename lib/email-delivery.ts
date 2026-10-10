import { getSupabaseAdmin } from "@/lib/supabase-admin";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] ?? char));
}

const DRIVE_SET_A = "https://drive.google.com/drive/folders/1ValEsVEyMdq171PrIvYo3H5xRE_LlxZe";
const DRIVE_SET_B = "https://drive.google.com/drive/folders/17zSebHpDCut2Kr-njtEoNupU4i-NzhOB";

export async function deliverPaidPdfOrder(order: { id: string; order_number: string; customer_name: string; customer_email: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Missing RESEND_API_KEY or EMAIL_FROM environment variable.");

  const { data: items, error: itemsError } = await getSupabaseAdmin()
    .from("celik_minda_order_items")
    .select("product_id, product_name, format")
    .eq("order_id", order.id);
  if (itemsError) throw new Error(`Could not load order items: ${itemsError.message}`);
  if (!items?.length) throw new Error("No items found for paid order.");

  const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
  const { data: products, error: productsError } = await getSupabaseAdmin()
    .from("celik_minda_products")
    .select("id, sku")
    .in("id", productIds);
  if (productsError) throw new Error(`Could not load product SKUs: ${productsError.message}`);
  const skuById = new Map((products || []).map((product) => [product.id, String(product.sku)]));
  const skus = items.map((item) => skuById.get(item.product_id) || "");
  const wantsPdf = items.some((item, index) => String(item.format || "").toLowerCase() === "pdf" || skus[index].endsWith("-PDF"));
  if (!wantsPdf) {
    await getSupabaseAdmin().from("celik_minda_orders").update({ delivery_email_status: "not_required" }).eq("id", order.id);
    return { sent: false, reason: "hardcopy_only" as const };
  }

  const links: { label: string; url: string }[] = [];
  for (let index = 0; index < items.length; index++) {
    const sku = skus[index];
    const isPdf = String(items[index].format || "").toLowerCase() === "pdf" || sku.endsWith("-PDF");
    if (!isPdf) continue;
    if (sku === "CMA-PDF") links.push({ label: "Set A — 5 Tahun", url: DRIVE_SET_A });
    else if (sku === "CMB-PDF") links.push({ label: "Set B — 6 Tahun", url: DRIVE_SET_B });
    else if (sku === "CMAB-PDF") {
      links.push({ label: "Set A — 5 Tahun", url: DRIVE_SET_A });
      links.push({ label: "Set B — 6 Tahun", url: DRIVE_SET_B });
    }
  }
  if (!links.length) throw new Error("No matching PDF links configured for this order.");

  const customerName = escapeHtml(order.customer_name || "Pelanggan");
  const orderNumber = escapeHtml(String(order.order_number));
  const linkHtml = links.map((link) => `<li style=\"margin:12px 0\"><a href=\"${link.url}\">Muat turun ${escapeHtml(link.label)}</a></li>`).join("");
  const linkText = links.map((link) => `${link.label}: ${link.url}`).join("\n\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [order.customer_email],
      subject: `Bahan Ulang Kaji Celik Minda — Pesanan ${order.order_number}`,
      text: `Assalamualaikum ${order.customer_name || ""},\n\nTerima kasih. Bayaran untuk pesanan ${order.order_number} telah disahkan. Gunakan pautan berikut untuk mendapatkan bahan PDF anda. Pautan Google Drive tertakluk pada tetapan perkongsian folder.\n\n${linkText}\n\nJika ada masalah, balas e-mel ini untuk bantuan.`,
      html: `<div style=\"font-family:Arial,sans-serif;line-height:1.7;color:#173b28;max-width:620px;margin:auto\"><h2 style=\"color:#14532d\">Pesanan Celik Minda Berjaya</h2><p>Assalamualaikum ${customerName},</p><p>Bayaran untuk pesanan <strong>${orderNumber}</strong> telah disahkan. Klik pautan di bawah untuk mendapatkan bahan PDF anda.</p><ul>${linkHtml}</ul><p style=\"background:#f7f8ef;padding:12px;border-radius:8px\">Pautan Google Drive tertakluk pada tetapan perkongsian folder.</p><p>Terima kasih kerana membeli bahan Ulang Kaji Celik Minda.</p></div>`,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${body.slice(0, 500)}`);
  }
  return { sent: true as const };
}
