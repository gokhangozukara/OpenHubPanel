import { ArrowRight, Blocks, Code2, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const preview = process.env.NODE_ENV !== "production" && process.env.OPENHUB_PREVIEW === "1";
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <span className="brand-symbol">
          <Blocks size={26} aria-hidden="true" />
        </span>
        <p className="eyebrow">OPENHUBPANEL</p>
        <h1>All in one panel.</h1>
        <p className="welcome-description">
          Sitelerin, uygulamaların ve ekibin.
          <br />
          Hepsi için tek bir yönetim merkezi.
        </p>
        <div className="welcome-actions">
          {preview && (
            <Link href="/preview" className="button primary">
              Paneli incele <ArrowRight size={16} />
            </Link>
          )}
          <a className="button secondary" href="https://github.com/gokhangozukara/OpenHubPanel">
            <Code2 size={16} /> GitHub
          </a>
        </div>
        <p className="welcome-note">
          <ShieldCheck size={16} aria-hidden="true" /> Geliştirme aşamasında · MIT açık kaynak
        </p>
        {preview ? (
          <p className="muted small">Panel önizlemesi örnek veriler kullanır. Canlı sistemlere bağlanmaz.</p>
        ) : (
          <p className="muted small">
            Yönetim erişimi henüz açılmadı. Kurulum ve geliştirme bilgileri GitHub deposunda.
          </p>
        )}
      </div>
    </main>
  );
}
