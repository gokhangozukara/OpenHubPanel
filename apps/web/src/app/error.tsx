"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <h1>Bir sorun oluştu.</h1>
        <p className="muted">İşlemi yeniden deneyebilirsin. İç sistem ayrıntıları bu ekranda gösterilmez.</p>
        <button type="button" className="button primary" onClick={reset}>
          Yeniden dene
        </button>
      </div>
    </main>
  );
}
