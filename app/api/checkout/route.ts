```ts
const { error: itemError } = await supabase
  .from("celik_minda_order_items")
  .insert({
    order_id: order.id,
    product_id: product.id,
    sku: product.sku,
    product_name: `${product.name} (${product.age_group})`,
    format: String(product.format).toLowerCase(),
    quantity: 1,
    unit_price_sen: totalSen,
    line_total_sen: totalSen,
  });

if (itemError) {
  console.error("Order item insert failed:", {
    message: itemError.message,
    code: itemError.code,
    details: itemError.details,
    hint: itemError.hint,
  });

  await supabase
    .from("celik_minda_orders")
    .delete()
    .eq("id", order.id);

  return NextResponse.json(
    {
      error: "Butiran produk gagal disimpan.",
      details: itemError.message,
      code: itemError.code,
      hint: itemError.hint,
    },
    { status: 500 }
  );
}
```
