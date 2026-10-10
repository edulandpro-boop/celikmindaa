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
  const [selectedGroup, setSelectedGroup] = useState("CMAB");
  const [selectedFormat, setSelectedFormat] = useState<"PDF" | "Hardcopy">("PDF");
  const selectedSku = `${selectedGroup}-${selectedFormat === "PDF" ? "PDF" : "HC"}`;
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
  const isHardcopy = selectedFormat === "Hardcopy";

  function update(key: keyof FormState, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  function chooseProduct(group: string) {
    setSelectedGroup(group);
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
              <h1>Anak Dah Mula Bersedia Untuk Ujian Celik Minda?</h1>
              <p>Tak perlu tunggu saat akhir. Luangkan sedikit masa setiap hari untuk ulang kaji bersama anak menggunakan bahan Celik Minda PASTI. Mak ayah boleh pilih PDF untuk cetak sendiri atau hardcopy yang dihantar ke rumah.</p>
              <div className="hero-promise">
                <strong>Mulakan dengan langkah kecil hari ini.</strong>
                <span>Pilih set mengikut umur anak, sediakan bahan, kemudian temani mereka berlatih mengikut kemampuan sendiri.</span>
              </div>
              <div className="actions">
                <a className="btn btn-gold" href="#produk">Pilih Set Anak <span aria-hidden="true">→</span></a>
                <a className="btn btn-light" href="#cara">Cara Pembelian</a>
              </div>
            </div>
            <div className="hero-art" aria-label="Gambar produk Combo Set A dan Set B yang dibekalkan oleh pemilik">
              <div className="floating float-one">Mula ulang kaji dari rumah</div>
              <img
                className="hero-product-image"
                src="/images/combo-set-a-b.jpg"
                alt="Cover Combo Latihan Celik Minda Set 5 dan 6 Tahun"
              />
              <div className="floating float-two">Pilih ikut keselesaan anda</div>
            </div>
          </div>
        </section>

        <section className="section" id="produk">
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Pilihan untuk anak</span>
              <h2 className="section-title">Pilih Bahan Yang Sesuai Untuk Anak</h2>
              <p>Setiap anak belajar pada kadar yang berbeza. Pilih set mengikut umur dan cara ulang kaji yang paling mudah untuk keluarga anda — tanpa perlu membeli lebih daripada yang diperlukan.</p>
            </div>
            <div className="cards product-catalog">
              {[
                { group: "CMA", title: "Set A", desc: "Lihat poster dan kandungan bahan Set A.", badge: "SET A", image: "/images/set-a-6-tahun.jpg" },
                { group: "CMB", title: "Set B", desc: "Lihat poster dan kandungan bahan Set B.", badge: "SET B", image: "/images/set-b-5-tahun.jpg" },
                { group: "CMAB", title: "Combo Set A + B", desc: "Dapatkan kedua-dua set dalam satu pembelian.", badge: "PILIHAN COMBO", image: "/images/combo-set-a-b.jpg" },
              ].map((card) => {
                const chosen = selectedGroup === card.group;
                return <article className={`product ${chosen ? "selected-product" : ""}`} key={card.group}>
                  <img className="product-image" src={card.image} alt={`Poster ${card.title} Celik Minda PASTI`} loading="lazy" />
                  <div className="product-top"><span className="pill">{card.badge}</span>{chosen && <span className="chosen-tag">Dipilih</span>}</div>
                  <h3>{card.title}</h3>
                  <p className="desc">{card.desc}</p>
                  <div className="format-label">Pilih format semasa pembayaran</div>
                  <button className={`btn ${chosen ? "btn-selected" : "btn-gold"}`} type="button" onClick={() => chooseProduct(card.group)}>{chosen ? "Set dipilih ✓" : "Pilih set ini →"}</button>
                </article>;
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 22, color: "var(--muted)", fontSize: 13 }}>
              Pilih poster set dahulu. Format PDF atau hardcopy dan harga akan dipilih di bahagian pembayaran.
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
              <div className="benefit"><div className="benefit-icon">⌂</div><h3>Tak Perlu Tunggu Saat Akhir</h3><p>Bina rutin ulang kaji yang ringkas dari sekarang. Mulakan satu sesi pada satu masa mengikut kelapangan keluarga.</p></div>
              <div className="benefit"><div className="benefit-icon">▤</div><h3>Pilih Ikut Bajet &amp; Keperluan</h3><p>Set individu bermula RM10. Pilih PDF untuk cetak sendiri atau hardcopy jika lebih mudah untuk anak membuat latihan.</p></div>
              <div className="benefit"><div className="benefit-icon">♡</div><h3>Anak Perlukan Bimbingan, Bukan Tekanan</h3><p>Gunakan bahan ini sebagai peluang untuk duduk bersama, beri galakan dan kenal pasti bahagian yang perlu diulang kaji.</p></div>
            </div>
          </div>
        </section>

        <section className="section order-section" id="order">
          <div className="shell order-layout">
            <div className="order-copy">
              <span className="kicker">Tempahan online</span>
              <h2 className="section-title">Sediakan Bahan Ulang Kaji Anak</h2>
              <p>Pilih poster Set A, Set B atau Combo di atas. Di bahagian pembayaran, pilih PDF atau hardcopy; alamat rumah hanya diperlukan untuk hardcopy.</p>
              <div className="notice"><strong>Supaya tak tersalah pilih:</strong><br />Poster produk dipaparkan dahulu. Pilih format di sini: PDF untuk cetak sendiri atau hardcopy untuk dihantar ke rumah. Combo hardcopy Set A + B berharga RM20 termasuk postage.</div>
              <div className="purchase-reassurance">
                <div><strong>Harga dipaparkan awal</strong><span>Semak jumlah sebelum meneruskan pembayaran.</span></div>
                <div><strong>Pilihan yang jelas</strong><span>Set A, Set B atau Combo; PDF atau hardcopy mengikut pilihan tersedia.</span></div>
                <div><strong>Maklumat pesanan</strong><span>Masukkan e-mel yang aktif supaya maklumat pesanan boleh dihubungkan dengan pembelian.</span></div>
              </div>
            </div>
            <form className="form-card" onSubmit={submitOrder}>
              <div className="checkout-heading"><span className="checkout-step">LANGKAH 1 · SEMAK PILIHAN</span><h3>Butiran tempahan anda</h3><p>Pastikan set dan format betul sebelum meneruskan ke pembayaran.</p></div>
              <div className="selected-summary">
                <div><span>Produk dipilih</span><strong>{selected ? `${selected.name} · ${selected.format}` : selectedSku}</strong></div>
                <div><span>Jumlah produk</span><strong>{selected ? money(selected.price) : "—"}</strong></div>
                <button type="button" className="text-link" onClick={() => document.getElementById("produk")?.scrollIntoView({ behavior: "smooth" })}>Tukar pilihan produk</button>
              </div>
              <div className="payment-method-card"><span className="checkout-step">LANGKAH 2 · PEMBAYARAN</span><div className="payment-method-title"><span className="payment-icon">FPX</span><div><strong>Perbankan online melalui Bayarcash</strong><small>Anda akan dibawa ke halaman pembayaran yang selamat untuk memilih bank.</small></div></div><div className="payment-trust"><span>✓ Tiada maklumat perbankan diminta di borang ini</span><span>✓ Semak jumlah sebelum bayar</span></div></div>
              <div className="checkout-heading customer-heading"><span className="checkout-step">LANGKAH 3 · MAKLUMAT PEMBELI</span><h3>Maklumat pembeli dan penghantaran</h3><p>Alamat rumah hanya akan diminta jika anda memilih hardcopy. Pembelian PDF tidak memerlukan alamat penghantaran.</p></div>
              <div className="field">
                <label htmlFor="format">Pilih format bahan</label>
                <select id="format" value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value as "PDF" | "Hardcopy")} required>
                  <option value="PDF">PDF — {selectedGroup === "CMAB" ? "RM18" : "RM10"} · fail digital, cetak sendiri</option>
                  <option value="Hardcopy">Hardcopy — {selectedGroup === "CMAB" ? "RM20 termasuk postage" : "RM15"} · dihantar ke rumah</option>
                </select>
                <small className="field-hint">Set dipilih: {selectedGroup === "CMA" ? "Set A" : selectedGroup === "CMB" ? "Set B" : "Combo Set A + B"}</small>
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
              <div className="total"><div><span>Jumlah perlu dibayar</span><small>{isHardcopy ? "Bahan bercetak" : "Produk digital PDF"}{selected?.includes_postage ? " · postage termasuk" : ""}</small></div><strong>{selected ? money(selected.price) : "—"}</strong></div>
              <button className="btn btn-green" type="submit" disabled={loading} style={{ width: "100%" }}>{loading ? "Sedang menyediakan bayaran..." : "Teruskan ke pembayaran FPX →"}</button>
              {message && <div className={`message ${isError ? "error" : ""}`} role="status">{message}</div>}
              <p style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.6, margin: "12px 0 0" }}>Maklumat anda digunakan untuk memproses pesanan dan penghantaran. Jangan masukkan maklumat kad atau kata laluan bank pada borang ini.</p>
            </form>
          </div>
        </section>

        <section className="section" id="cara">
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Soalan lazim</span>
              <h2 className="section-title">Masih Ada Soalan Sebelum Membeli?</h2>
            </div>
            <div className="faq">
              <details><summary>Bilakah Ujian Celik Minda PASTI?</summary><p>Tarikh yang digunakan pada halaman ini ialah 20 Oktober 2026. Sila rujuk pengumuman rasmi PASTI untuk pengesahan tarikh di kawasan masing-masing.</p></details>
              <details><summary>Apakah beza PDF dan hardcopy?</summary><p>PDF ialah bahan digital. Hardcopy ialah bahan bercetak yang dihantar ke alamat yang diberikan semasa tempahan.</p></details>
              <details><summary>Berapa harga combo?</summary><p>Combo PDF Set A + B ialah RM18. Combo hardcopy Set A + B ialah RM20 termasuk postage.</p></details>
              <details><summary>Bagaimana pembayaran dibuat?</summary><p>Tekan butang tempahan, isi maklumat dan teruskan ke halaman pembayaran Bayarcash. Status pesanan akan dikemas kini melalui notifikasi pembayaran yang disahkan.</p></details>
              <details><summary>Adakah bahan ini menjamin anak mendapat keputusan tertentu?</summary><p>Tidak. Set ini ialah bahan sokongan ulang kaji dan bukan jaminan keputusan ujian. Hasil latihan bergantung pada pelbagai faktor termasuk kesediaan dan bimbingan anak.</p></details>
              <details><summary>Bagaimana saya memilih set yang sesuai?</summary><p>Pilih Set A untuk umur 5 tahun atau Set B untuk umur 6 tahun seperti yang disenaraikan. Jika perlukan kedua-duanya, pilih Combo Set A + B. Semak tajuk, format dan harga sebelum membuat bayaran.</p></details>
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
