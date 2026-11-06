import Link from "next/link";

export default function NotFound() {
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <p className="eyebrow">404</p>
        <h1>Bu sayfa bulunamadı.</h1>
        <p className="muted">Bağlantıyı kontrol edebilir veya ana sayfaya dönebilirsin.</p>
        <Link href="/" className="button primary">
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
