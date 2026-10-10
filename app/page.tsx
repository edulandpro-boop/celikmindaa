
"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  sku: string;
  name: string;
  target_age: string;
  format: "PDF" | "Hardcopy";
  price: number | string;
  includes_postage: boolean;
  description: string | null;
};

type FormState = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  city: string;
  state: string;
};

const initialForm: FormState = {
  customerName: "",
  phone: "",
  email: "",
  address: "",
  postcode: "",
  city: "",
  state: "",
};

const money = (value: number | string) =>
  `RM${Number(value).toFixed(2)}`;

const sets = [
  { value: "CMA", label: "Set A", age: "5 Tahun" },
  { value: "CMB", label: "Set B", age: "6 Tahun" },
  { value: "CMAB", label: "Combo Set A + B", age: "5 & 6 Tahun" },
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSet, setSelectedSet] = useState("CMAB");
  const [selectedFormat, setSelectedFormat] = useState<"PDF" | "Hardcopy">("PDF");
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const selectedSku = `${selectedSet}-${selectedFormat === "PDF" ? "PDF" : "HC"}`;

  useEffect(() => {
    fetch("/api/products")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Produk gagal dimuatkan.");
        setProducts(data.products || []);
      })
      .catch((e) => {
        setMessage(e.message);
        setIsError(true);
      });
  }, []);

  const selected = useMemo(
    () => products.find((p) => p.sku === selectedSku),
    [products, selectedSku]
  );

  const isHardcopy = selectedFormat === "Hardcopy";

  function update(key: keyof FormState, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function chooseProduct(sku: string) {
    const parts = sku.split("-");
    const set = parts[0];
    const format = parts[1] === "HC" ? "Hardcopy" : "PDF";

    setSelectedSet(set);
    setSelectedFormat(format);
    setMessage("");

    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: selectedSku, ...form }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Pesanan tidak berjaya.");
      }

      if (!data.checkoutUrl) {
        throw new Error("Pautan pembayaran tidak diterima. Sila cuba lagi.");
      }

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
            <span>
              CELIK MINDA PASTI
              <small>Bahan Ulang Kaji Anak Soleh</small>
            </span>
          </a>
          <a className="navtag" href="#produk">
            Set A · Set B · Combo
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="shell hero-grid">
            <div>
              <span className="eyebrow">Ujian · 20 Oktober 2026</span>
              <h1>Jom Bantu Anak Bersedia Untuk Ujian Celik Minda!</h1>
              <p>
                Persediaan awal bersama mak ayah di rumah melalui bahan ulang
                kaji Celik Minda PASTI. Pilih PDF untuk cetak sendiri atau
                hardcopy yang dihantar terus kepada anda.
              </p>
              <div className="actions">
                <a className="btn btn-gold" href="#produk">
                  Pilih Set Anak <span aria-hidden="true">→</span>
                </a>
                <a className="btn btn-light" href="#cara">
                  Cara Pembelian
                </a>
              </div>
            </div>

            <div
              className="hero-art"
              aria-label="Gambar produk Combo Set A dan Set B"
            >
              <div className="floating float-one">Persediaan dari rumah</div>
              <img
                className="hero-product-image"
                src="/images/combo-set-a-b.jpg"
                alt="Cover Combo Latihan Celik Minda Set 5 dan 6 Tahun"
              />
              <div className="floating float-two">
                PDF &amp; Hardcopy tersedia
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="produk">
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Pilihan untuk anak</span>
              <h2 className="section-title">Pilih Set Ulang Kaji Anda</h2>
              <p>
                Pilih set yang sesuai, kemudian tentukan sama ada PDF atau
                hardcopy.
              </p>
            </div>

            <div className="cards">
              {[
                {
                  sku: "CMA-PDF",
                  title: "Set A · 5 Tahun",
                  desc: "Bahan ulang kaji untuk anak 5 tahun.",
                  badge: "SET A",
                  image: "/images/set-a-6-tahun.jpg",
                  alt: "Poster Set A Celik Minda",
                  featured: false,
                },
                {
                  sku: "CMB-PDF",
                  title: "Set B · 6 Tahun",
                  desc: "Bahan ulang kaji untuk anak 6 tahun.",
                  badge: "SET B",
                  image: "/images/set-b-5-tahun.jpg",
                  alt: "Poster Set B Celik Minda",
                  featured: false,
                },
                {
                  sku: "CMAB-PDF",
                  title: "Combo Set A + B",
                  desc: "Kedua-dua set untuk umur 5 dan 6 tahun.",
                  badge: "COMBO",
                  image: "/images/combo-set-a-b.jpg",
                  alt: "Poster Combo Set A dan B",
                  featured: true,
                },
              ].map((card) => {
                const product = products.find((p) => p.sku === card.sku);

                return (
                  <article
                    className={`product ${card.featured ? "featured" : ""}`}
                    key={card.sku}
                  >
                    <img
                      className="product-image"
                      src={card.image}
                      alt={card.alt}
                      loading="lazy"
                    />

                    <div className="product-top">
                      <span className={`pill ${card.featured ? "gold" : ""}`}>
                        {card.badge}
                      </span>
                    </div>

                    <h3>{card.title}</h3>
                    <p className="desc">{card.desc}</p>

                    <div className="price">
                      {product ? money(product.price) : "—"}
                    </div>

                    <div className="price-note">
                      Harga bermula daripada PDF
                    </div>

                    <button
                      className={`btn ${card.featured ? "btn-green" : "btn-gold"}`}
                      type="button"
                      onClick={() => chooseProduct(card.sku)}
                    >
                      Pilih Set Ini
                    </button>
                  </article>
                );
              })}
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: 22,
                color: "var(--muted)",
                fontSize: 13,
              }}
            >
              Set A PDF RM10 · Set A hardcopy RM15 · Set B PDF RM10 · Set B
              hardcopy RM15 · Combo PDF RM18 · Combo hardcopy RM20 termasuk
              postage.
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="shell">
            <div className="section-head">
              <span className="kicker">Mudah untuk mak ayah</span>
              <h2 className="section-title">
                Mulakan Persediaan Dari Sekarang
              </h2>
            </div>

            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon">⌂</div>
                <h3>Ulang Kaji di Rumah</h3>
                <p>
                  Luangkan masa bersama anak dan bantu mereka membiasakan diri
                  dengan rutin latihan.
                </p>
              </div>

              <div className="benefit">
                <div className="benefit-icon">▤</div>
                <h3>Pilih PDF atau Hardcopy</h3>
                <p>
                  PDF boleh dicetak sendiri. Hardcopy ialah bahan bercetak yang
                  dihantar kepada anda.
                </p>
              </div>

              <div className="benefit">
                <div className="benefit-icon">♡</div>
                <h3>Sokongan Mak Ayah</h3>
                <p>
                  Temani anak, beri galakan dan sesuaikan sesi ulang kaji
                  dengan kemampuan mereka.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section order-section" id="order">
          <div className="shell order-layout">
            <div className="order-copy">
              <span className="kicker">Tempahan online</span>
              <h2 className="section-title">Tempah Set Pilihan Anda</h2>
              <p>
                Pilih set dan format, isi maklumat anda, kemudian teruskan ke
                halaman pembayaran.
              </p>
              <div className="notice">
                Untuk hardcopy, isi alamat penghantaran dengan lengkap. Combo
                hardcopy berharga RM20 termasuk postage. PDF ialah produk
                digital, bukan buku fizikal.
              </div>
            </div>

            <form className="form-card" onSubmit={submitOrder}>
              <div className="field">
                <label htmlFor="setChoice">1. Pilih set</label>
                <select
                  id="setChoice"
                  value={selectedSet}
                  onChange={(e) => {
                    setSelectedSet(e.target.value);
                    setMessage("");
                  }}
                  required
                >
                  {sets.map((set) => (
                    <option key={set.value} value={set.value}>
                      {set.label} · {set.age}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginTop: 18 }}>
                <label>2. Pilih format</label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  {(["PDF", "Hardcopy"] as const).map((format) => {
                    const sku = `${selectedSet}-${format === "PDF" ? "PDF" : "HC"}`;
                    const product = products.find((p) => p.sku === sku);
                    const active = selectedFormat === format;

                    return (
                      <button
                        key={format}
                        type="button"
                        onClick={() => {
                          setSelectedFormat(format);
                          setMessage("");
                        }}
                        aria-pressed={active}
                        style={{
                          padding: "16px 10px",
                          borderRadius: 12,
                          border: active
                            ? "2px solid var(--green, #26865b)"
                            : "1px solid var(--border, #ddd)",
                          background: active
                            ? "var(--soft-green, #eef8f1)"
                            : "white",
                          color: "var(--text, #333)",
                          cursor: "pointer",
                          textAlign: "center",
                          font: "inherit",
                        }}
                      >
                        <strong style={{ display: "block", marginBottom: 6 }}>
                          {format}
                        </strong>
                        <span style={{ display: "block", fontSize: 13 }}>
                          {product ? money(product.price) : "Memuatkan harga…"}
                        </span>
                        <small style={{ display: "block", marginTop: 5 }}>
                          {format === "PDF" ? "Cetak sendiri" : "Dihantar ke rumah"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-grid" style={{ marginTop: 22 }}>
                <div className="field">
                  <label htmlFor="name">Nama penuh</label>
                  <input
                    id="name"
                    autoComplete="name"
                    value={form.customerName}
                    onChange={(e) => update("customerName", e.target.value)}
                    required
                    maxLength={150}
                    placeholder="Nama ibu/bapa"
                  />
                </div>

                <div className="field">
                  <label htmlFor="phone">Nombor telefon</label>
                  <input
                    id="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    required
                    maxLength={30}
                    placeholder="Contoh: 0123456789"
                  />
                </div>

                <div className="field full">
                  <label htmlFor="email">E-mel</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                    placeholder="anda@email.com"
                  />
                </div>

                {isHardcopy && (
                  <>
                    <div className="field full">
                      <label htmlFor="address">Alamat penghantaran</label>
                      <textarea
                        id="address"
                        autoComplete="street-address"
                        rows={3}
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        required
                        placeholder="Nombor rumah, jalan, taman, daerah"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="postcode">Poskod</label>
                      <input
                        id="postcode"
                        autoComplete="postal-code"
                        value={form.postcode}
                        onChange={(e) => update("postcode", e.target.value)}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="city">Bandar / daerah</label>
                      <input
                        id="city"
                        autoComplete="address-level2"
                        value={form.city}
                        onChange={(e) => update("city", e.target.value)}
                        required
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor="state">Negeri</label>
                      <select
                        id="state"
                        value={form.state}
                        onChange={(e) => update("state", e.target.value)}
                        required
                      >
                        <option value="">Pilih negeri</option>
                        {[
                          "Johor",
                          "Kedah",
                          "Kelantan",
                          "Melaka",
                          "Negeri Sembilan",
                          "Pahang",
                          "Perak",
                          "Perlis",
                          "Pulau Pinang",
                          "Sabah",
                          "Sarawak",
                          "Selangor",
                          "Terengganu",
                          "Kuala Lumpur",
                          "Labuan",
                          "Putrajaya",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="total">
                <span>Jumlah bayaran</span>
                <strong>{selected ? money(selected.price) : "—"}</strong>
              </div>

              <button
                className="btn btn-green"
                type="submit"
                disabled={loading || !selected}
                style={{ width: "100%" }}
              >
                {loading
                  ? "Sedang menyediakan bayaran..."
                  : "Teruskan ke Pembayaran →"}
              </button>

              {message && (
                <div
                  className={`message ${isError ? "error" : ""}`}
                  role="status"
                >
                  {message}
                </div>
              )}

              <p
                style={{
                  color: "var(--muted)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  margin: "12px 0 0",
                }}
              >
                Maklumat anda digunakan untuk memproses pesanan dan
                penghantaran. Jangan masukkan maklumat kad atau kata laluan
                bank pada borang ini.
              </p>
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
              <details>
                <summary>Bilakah Ujian Celik Minda PASTI?</summary>
                <p>
                  Tarikh yang digunakan pada halaman ini ialah 20 Oktober
                  2026. Sila rujuk pengumuman rasmi PASTI untuk pengesahan
                  tarikh di kawasan masing-masing.
                </p>
              </details>

              <details>
                <summary>Apakah beza PDF dan hardcopy?</summary>
                <p>
                  PDF ialah bahan digital untuk dicetak sendiri. Hardcopy
                  ialah bahan bercetak yang dihantar ke alamat anda.
                </p>
              </details>

              <details>
                <summary>Berapa harga combo?</summary>
                <p>
                  Combo PDF Set A + B ialah RM18. Combo hardcopy Set A + B
                  ialah RM20 termasuk postage.
                </p>
              </details>

              <details>
                <summary>Bagaimana pembayaran dibuat?</summary>
                <p>
                  Pilih set dan format, isi maklumat tempahan, kemudian tekan
                  Teruskan ke Pembayaran untuk pergi ke halaman Bayarcash.
                </p>
              </details>

              <details>
                <summary>Adakah pembelian menjamin keputusan ujian?</summary>
                <p>
                  Tidak. Bahan ini bertujuan membantu sesi ulang kaji dan
                  bukan jaminan keputusan peperiksaan.
                </p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer-inner">
          <div className="brand">
            <span className="brandmark">✦</span>
            <span>
              MIFAIRAA STUDIO
              <small>All Your Needs Here</small>
            </span>
          </div>
          <div>
            <p>Produk digital dan bahan bercetak.</p>
            <p>© 2026 MIFAIRAA Studio. Tertakluk pada terma jualan.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
