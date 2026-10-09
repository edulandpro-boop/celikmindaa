 "use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string; sku: string; name: string; target_age: string;
  format: "PDF" | "Hardcopy"; price: number | string;
  includes_postage: boolean; description: string | null;
};
type FormState = {
  customerName: string; phone: string; email: string; address: string;
  postcode: string; city: string; state: string;
};

const initialForm: FormState = {
  customerName: "", phone: "", email: "", address: "", postcode: "", city: "", state: ""
};
const money = (value: number | string) => `RM${Number(value).toFixed(2)}`;

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSku, setSelectedSku] = useState("CMAB-PDF");
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Produk gagal dimuatkan.");
        setProducts(data.products || []);
      })
      .catch((e) => { setMessage(e.message); setIsError(true); });
  }, []);

  const selected = useMemo(() => products.find((p) => p.sku === selectedSku), [products, selectedSku]);
  const isHardcopy = selected?.format === "Hardcopy";

  function update(key: keyof FormState, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  function chooseProduct(sku: string) {
    setSelectedSku(sku);
    setMessage("");
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  }
  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setMessage(""); setIsError(false);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: selectedSku, ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pesanan tidak berjaya.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Sila cuba lagi.");
      setLoading(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell nav">
          <a href="#" className="brand">
            <span className="brandmark">✦</span>
            <span>CELIK MINDA PASTI<small>Bahan Ulang Kaji Anak Soleh</small></span>
          </a>
          <a className="navtag" href="#produk">Set A · Set B · Combo</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="shell hero-grid">
            <div>
              <span className="eyebrow">Ujian · 20 Oktober 2026</span>
              <h1>Jom Bantu Anak Bersedia Untuk Ujian Celik Minda!</h1>
              <p>Persediaan awal bersama mak ayah di rumah melalui bahan ulang kaji Celik Minda PASTI. Pilih PDF untuk cetak sendiri atau hardcopy yang dihantar terus kepada anda.</p>
              <div className="actions">
                <a className="btn btn-gold" href="#produk">Pilih Set Anak <span aria-hidden="true">→</span></a>
                <a className="btn btn-light" href="#cara">Cara Pembelian</a>
              </div>
            </div>
            <div className="hero-art" aria-label="Gambar produk Combo Set A dan Set B yang dibekalkan oleh pemilik">
              <div className="floating float-one">Persediaan dari rumah</div>
              <img
                className="hero-product-image"
                src="/images/combo-set-a-b.jpg"
                alt="Cover Combo Latihan Celik Minda Set 5 dan 6 Tahun"
              />
              <div className="floating float-two">PDF &amp; Hardcopy tersedia</div>
            </div>
          </div>
        </section>

        <section className="section" id="produk">
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Pilihan untuk anak</span>
              <h2 className="section-title">Pilih Set Ulang Kaji Anda</h2>
              <p>Pilih mengikut umur anak dan format yang paling sesuai. Harga dipaparkan daripada katalog produk Supabase.</p>
            </div>
            <div className="cards">
              {[
                { sku: "CMA-PDF", title: "Set A · 5 Tahun", desc: "PDF digital untuk dicetak sendiri.", badge: "FORMAT PDF", image: "/images/set-a-6-tahun.jpg", alt: "Poster Set A PDF; sila semak artwork umur pada imej" },
                { sku: "CMB-PDF", title: "Set B · 6 Tahun", desc: "PDF digital untuk dicetak sendiri.", badge: "FORMAT PDF", image: "/images/set-b-5-tahun.jpg", alt: "Poster Set B PDF; sila semak artwork umur pada imej" },
                { sku: "CMAB-PDF", title: "Combo Set A + B · PDF", desc: "Kedua-dua set dalam format PDF. Cetak sendiri.", badge: "COMBO PDF", image: "/images/combo-set-a-b.jpg", alt: "Poster Combo PDF Set 5 dan 6 Tahun, harga RM18", featured: true },
                { sku: "CMAB-HC", title: "Combo Set A + B · Hardcopy", desc: "Kedua-dua set bercetak dan dihantar ke alamat anda.", badge: "COMBO HARDCOPY", image: null, alt: "", featured: false, hardcopy: true },
              ].map((card) => {
                const product = products.find((p) => p.sku === card.sku);
                return <article className={`product ${card.featured ? "featured" : ""}`} key={card.sku}>
                  {card.image ? <img className="product-image" src={card.image} alt={card.alt} loading="lazy" /> : <div className="product-image product-placeholder" role="img" aria-label="Combo Set A dan B hardcopy RM20 termasuk postage"><span>COMBO SET A + B</span><strong>HARDCOPY</strong><b>RM20</b><small>Termasuk postage</small></div>}
                  <div className="product-top"><span className={`pill ${card.featured ? "gold" : ""}`}>{card.badge}</span>{card.featured && <span aria-hidden="true">✦</span>}</div>
                  <h3>{card.title}</h3>
                  <p className="desc">{card.desc}</p>
                  <div className="price">{product ? money(product.price) : "—"}</div>
                  <div className="price-note">{card.sku === "CMAB-HC" ? "RM20 termasuk postage" : card.sku === "CMAB-PDF" ? "PDF digital · tiada penghantaran fizikal" : "PDF digital · cetak sendiri"}</div>
                  <button className={`btn ${card.featured ? "btn-green" : "btn-gold"}`} onClick={() => chooseProduct(card.sku)}>Pilih {card.sku.endsWith("HC") ? "hardcopy" : "PDF"}</button>
                  <small>{card.sku === "CMAB-HC" ? "Bahan bercetak dihantar ke alamat anda." : card.sku === "CMAB-PDF" ? "Harga ini untuk Combo PDF, bukan hardcopy." : "Pilihan hardcopy satu set tersedia di borang tempahan."}</small>
                </article>;
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 22, color: "var(--muted)", fontSize: 13 }}>
              Set A PDF RM10 · Set A hardcopy RM15 · Set B PDF RM10 · Set B hardcopy RM15 · Combo PDF RM18 · Combo hardcopy RM20 termasuk postage.
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Mudah untuk mak ayah</span>
              <h2 className="section-title">Mulakan Persediaan Dari Sekarang</h2>
            </div>
            <div className="benefits">
              <div className="benefit"><div className="benefit-icon">⌂</div><h3>Ulang Kaji di Rumah</h3><p>Luangkan masa bersama anak dan bantu mereka membiasakan diri dengan rutin latihan.</p></div>
              <div className="benefit"><div className="benefit-icon">▤</div><h3>Pilih PDF atau Hardcopy</h3><p>PDF boleh dicetak sendiri. Hardcopy lebih mudah digunakan tanpa perlu mencetak.</p></div>
              <div className="benefit"><div className="benefit-icon">♡</div><h3>Sokongan Mak Ayah</h3><p>Temani anak, beri galakan dan sesuaikan sesi ulang kaji dengan kemampuan mereka.</p></div>
            </div>
          </div>
        </section>

        <section className="section order-section" id="order">
          <div className="shell order-layout">
            <div className="order-copy">
              <span className="kicker">Tempahan online</span>
              <h2 className="section-title">Tempah Set Pilihan Anda</h2>
              <p>Isi maklumat di bawah. Anda akan dibawa ke halaman pembayaran Bayarcash untuk melengkapkan transaksi.</p>
              <div className="notice">Untuk hardcopy, isi alamat penghantaran dengan lengkap. Combo hardcopy berharga RM20 termasuk postage. Produk PDF ialah produk digital, bukan buku fizikal.</div>
            </div>
            <form className="form-card" onSubmit={submitOrder}>
              <div className="field">
                <label htmlFor="sku">Pilih produk</label>
                <select id="sku" value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)} required>
                  <option value="CMA-PDF">Set A · 5 Tahun · PDF · RM10</option>
                  <option value="CMA-HC">Set A · 5 Tahun · Hardcopy · RM15</option>
                  <option value="CMB-PDF">Set B · 6 Tahun · PDF · RM10</option>
                  <option value="CMB-HC">Set B · 6 Tahun · Hardcopy · RM15</option>
                  <option value="CMAB-PDF">Combo Set A + B · PDF · RM18</option>
                  <option value="CMAB-HC">Combo Set A + B · Hardcopy · RM20 termasuk postage</option>
                </select>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="name">Nama penuh</label><input id="name" autoComplete="name" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} required maxLength={150} placeholder="Nama ibu/bapa" /></div>
                <div className="field"><label htmlFor="phone">Nombor telefon</label><input id="phone" autoComplete="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required maxLength={30} placeholder="Contoh: 0123456789" /></div>
                <div className="field full"><label htmlFor="email">E-mel</label><input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} required placeholder="anda@email.com" /></div>
                {isHardcopy && <>
                  <div className="field full"><label htmlFor="address">Alamat penghantaran</label><textarea id="address" autoComplete="street-address" rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} required placeholder="Nombor rumah, jalan, taman, daerah" /></div>
                  <div className="field"><label htmlFor="postcode">Poskod</label><input id="postcode" autoComplete="postal-code" value={form.postcode} onChange={(e) => update("postcode", e.target.value)} required /></div>
                  <div className="field"><label htmlFor="city">Bandar / daerah</label><input id="city" autoComplete="address-level2" value={form.city} onChange={(e) => update("city", e.target.value)} required /></div>
                  <div className="field full"><label htmlFor="state">Negeri</label><select id="state" value={form.state} onChange={(e) => update("state", e.target.value)} required><option value="">Pilih negeri</option>{["Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Selangor","Terengganu","Kuala Lumpur","Labuan","Putrajaya"].map((s) => <option key={s}>{s}</option>)}</select></div>
                </>}
              </div>
              <div className="total"><span>Jumlah bayaran</span><strong>{selected ? money(selected.price) : "—"}</strong></div>
              <button className="btn btn-green" type="submit" disabled={loading || products.length === 0} style={{ width: "100%" }}>{loading ? "Sedang menyediakan bayaran..." : "Teruskan ke Bayarcash →"}</button>
              {message && <div className={`message ${isError ? "error" : ""}`} role="status">{message}</div>}
              <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.6, margin: "12px 0 0" }}>Maklumat anda digunakan untuk memproses pesanan dan penghantaran. Jangan masukkan maklumat kad atau kata laluan bank pada borang ini.</p>
            </form>
          </div>
        </section>

        <section className="section" id="cara">
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Soalan lazim</span>
              <h2 className="section-title">Maklumat Sebelum Membeli</h2>
            </div>
            <div className="faq">
              <details><summary>Bilakah Ujian Celik Minda PASTI?</summary><p>Tarikh yang digunakan pada halaman ini ialah 20 Oktober 2026. Sila rujuk pengumuman rasmi PASTI untuk pengesahan tarikh di kawasan masing-masing.</p></details>
              <details><summary>Apakah beza PDF dan hardcopy?</summary><p>PDF ialah bahan digital. Hardcopy ialah bahan bercetak yang dihantar ke alamat yang diberikan semasa tempahan.</p></details>
              <details><summary>Berapa harga combo?</summary><p>Combo PDF Set A + B ialah RM18. Combo hardcopy Set A + B ialah RM20 termasuk postage.</p></details>
              <details><summary>Bagaimana pembayaran dibuat?</summary><p>Tekan butang tempahan, isi maklumat dan teruskan ke halaman pembayaran Bayarcash. Status pesanan akan dikemas kini melalui notifikasi pembayaran yang disahkan.</p></details>
              <details><summary>Adakah pembelian menjamin keputusan ujian?</summary><p>Tidak. Bahan ini bertujuan membantu sesi ulang kaji dan bukan jaminan keputusan peperiksaan.</p></details>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <div className="brand"><span className="brandmark">✦</span><span>MIFAIRAA STUDIO<small>All Your Needs Here</small></span></div>
          <div><p>Produk digital dan bahan bercetak.</p><p>© 2026 MIFAIRAA Studio. Tertakluk pada terma jualan.</p></div>
        </div>
      </footer>
    </>
  );
}
