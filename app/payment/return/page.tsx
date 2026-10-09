export default function PaymentReturnPage() {
  return (
    <main className="shell" style={{ padding: "80px 0", minHeight: "70vh" }}>
      <div className="form-card" style={{ maxWidth: 680, margin: "auto", textAlign: "center" }}>
        <div className="book-symbol">✓</div>
        <h1 style={{ color: "var(--forest)", fontSize: 36 }}>Terima kasih!</h1>
        <p style={{ color: "var(--muted)", lineHeight: 1.8 }}>
          Anda telah kembali daripada halaman pembayaran Bayarcash. Status pembayaran akan disahkan melalui notifikasi selamat Bayarcash.
        </p>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Jika pembayaran berjaya tetapi anda belum menerima maklumat pesanan, hubungi pihak penjual dengan nombor pesanan anda.
        </p>
        <a className="btn btn-green" href="/">Kembali ke halaman utama</a>
      </div>
    </main>
  );
}
