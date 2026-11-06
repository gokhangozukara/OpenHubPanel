"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { activities, applications, members, type PreviewApplication, workspaces } from "./fixtures";

const sections = [
  { id: "overview", name: "Genel bakış", icon: LayoutDashboard },
  { id: "applications", name: "Uygulamalar", icon: Blocks },
  { id: "team", name: "Ekip üyeleri", icon: Users },
  { id: "activity", name: "İşlem kaydı", icon: Activity },
  { id: "security", name: "Güvenlik", icon: ShieldCheck },
  { id: "settings", name: "Ayarlar", icon: Settings2 },
] as const;
type Section = (typeof sections)[number]["id"];
type Modal =
  | { kind: "connect" }
  | { kind: "invite" }
  | { kind: "application"; app: PreviewApplication }
  | null;
type Theme = "light" | "dark" | "system";

function Status({ connected }: { connected: boolean }) {
  return (
    <span className={`status ${connected ? "success" : "waiting"}`}>
      <span className="status-dot" />
      {connected ? "Bağlı" : "Kurulum bekliyor"}
    </span>
  );
}

function ApplicationTable({
  apps,
  workspaceName,
  onOpen,
  onClear,
}: {
  apps: PreviewApplication[];
  workspaceName: string;
  onOpen: (app: PreviewApplication) => void;
  onClear: () => void;
}) {
  return (
    <div className="table-scroll">
      <table className="app-table">
        <caption className="sr-only">{workspaceName} örnek uygulamaları</caption>
        <thead>
          <tr>
            <th scope="col">Uygulama</th>
            <th scope="col">Durum</th>
            <th scope="col">Erişim</th>
            <th scope="col">Son kontrol</th>
            <th scope="col">
              <span className="sr-only">Ayrıntı</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id}>
              <td>
                <button className="app-name-button" type="button" onClick={() => onOpen(app)}>
                  <span className={`app-icon ${app.color}`}>{app.initials}</span>
                  <span>
                    <strong>{app.name}</strong>
                    <span className="table-subtitle">{app.category}</span>
                  </span>
                </button>
              </td>
              <td>
                <Status connected={app.status === "connected"} />
              </td>
              <td className="muted">{app.permission}</td>
              <td className="muted">{app.updated}</td>
              <td>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${app.name} ayrıntıları`}
                  onClick={() => onOpen(app)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {apps.length === 0 && (
        <div className="empty-state">
          <Search size={28} />
          <h3>Uygulama bulunamadı</h3>
          <p>Başka bir isimle aramayı dene.</p>
          <button type="button" className="button secondary" onClick={onClear}>
            Aramayı temizle
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityList({ events }: { events: (typeof activities)[number][] }) {
  return (
    <ol className="activity-list">
      {events.map((event) => (
        <li key={event.title}>
          <span className="event-icon">
            {event.type === "edit" ? (
              <FileText size={17} />
            ) : event.type === "member" ? (
              <Users size={17} />
            ) : (
              <Link2 size={17} />
            )}
          </span>
          <div>
            <strong>{event.title}</strong>
            <p>{event.detail}</p>
          </div>
          <time>{event.time}</time>
        </li>
      ))}
    </ol>
  );
}

export function PreviewPanel() {
  const [section, setSection] = useState<Section>("overview");
  const [workspace, setWorkspace] = useState("atlas");
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [exampleTitle, setExampleTitle] = useState("Yeni bir başlangıç: ekibimizden haberler");
  const dialog = useRef<HTMLDialogElement>(null);
  const currentWorkspace = workspaces.find((item) => item.id === workspace) ?? workspaces[0];
  const apps = applications.filter((app) => app.workspace === workspace);
  const filteredApps = apps.filter((app) =>
    `${app.name} ${app.category}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")),
  );
  const team = members.filter((member) => member.workspace === workspace);
  const events = activities.filter((event) => event.workspace === workspace);
  const isOwner = workspace === "atlas";
  const connectedCount = apps.filter((app) => app.status === "connected").length;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("openhubpanel.theme");
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch {
      /* Theme storage is optional. */
    }
  }, []);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(next: Section) {
    setSection(next);
    setQuery("");
    setMobileOpen(false);
    setNotice("");
  }
  function changeWorkspace(next: string) {
    setWorkspace(next);
    setQuery("");
    setModal(null);
    setNotice("");
    setExampleTitle("Yeni bir başlangıç: ekibimizden haberler");
    setSection("overview");
    setMobileOpen(false);
  }
  function changeTheme(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("openhubpanel.theme", next);
    } catch {
      /* No sensitive data is persisted. */
    }
  }

  return (
    <div className="panel" data-theme={theme}>
      <a href="#main-content" className="skip-link">
        İçeriğe geç
      </a>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} aria-label="Ana menü">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Blocks size={21} aria-hidden="true" />
          </span>
          <span>
            OpenHubPanel<span className="brand-tagline">ALL IN ONE PANEL</span>
          </span>
        </a>
        <div className="workspace-control">
          <span className="workspace-avatar">{currentWorkspace.initials}</span>
          <div>
            <label htmlFor="workspace">Çalışma alanı</label>
            <select
              id="workspace"
              value={workspace}
              onChange={(event) => changeWorkspace(event.target.value)}
            >
              {workspaces.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <p className="nav-heading">YÖNETİM</p>
        <nav>
          {sections.map(({ id, name, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => navigate(id)}
              className={`nav-item ${section === id ? "active" : ""}`}
              aria-current={section === id ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{name}</span>
              {id === "applications" && <span className="nav-count">{apps.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-card-icon">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <strong>Birlikte daha iyi.</strong>
            <p>
              Uygulamanı bağla, işini kolaylaştır.
              <br />
              Açık kaynakla birlikte büyüyelim.
            </p>
            <a
              href="https://github.com/gokhangozukara/OpenHubPanel/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noreferrer"
            >
              Projeye katkıda bulun <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <a
            className="sidebar-docs"
            href="https://github.com/gokhangozukara/OpenHubPanel#readme"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={17} aria-hidden="true" /> Dokümantasyon{" "}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <div className="sidebar-profile">
            <span className="avatar teal">DY</span>
            <div>
              <strong>Demo Yönetici</strong>
              <span>{isOwner ? "Çalışma alanı sahibi" : "Görüntüleyici"}</span>
            </div>
            <span className="online-dot" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              type="button"
              aria-label="Menüyü aç"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={21} />
            </button>
            <FolderKanban size={17} aria-hidden="true" />
            <span>{currentWorkspace.name}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{sections.find((item) => item.id === section)?.name}</strong>
          </div>
          <div className="topbar-actions">
            <span className="preview-label">
              <span />
              Yerel önizleme
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
              onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small-avatar teal" title="Demo Yönetici">
              DY
            </span>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          <div className="preview-banner">
            <CircleHelp size={15} aria-hidden="true" />
            <span>
              Örnek verilerle tasarım önizlemesi. İşlemler bu ekranda kalır; canlı uygulamaları etkilemez.
            </span>
          </div>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{section === "overview" ? "ÇALIŞMA ALANIN" : "YÖNETİM MERKEZİ"}</p>
              <h1>
                {section === "overview"
                  ? "Her şey bir arada."
                  : sections.find((item) => item.id === section)?.name}
              </h1>
              <p>
                {section === "overview"
                  ? "Uygulamaların, ekibin ve günlük işlerin. Tek bir merkezde."
                  : section === "applications"
                    ? "Bağlı projelerini ve erişim durumlarını tek yerden takip et."
                    : section === "team"
                      ? "Doğru kişiye, doğru uygulama için doğru erişim."
                      : section === "activity"
                        ? "Çalışma alanında kimin ne yaptığını takip et."
                        : section === "security"
                          ? "Hesabın ve çalışma alanın için güvenlik temeli."
                          : "Çalışma alanını ve görünüm tercihlerini düzenle."}
              </p>
            </div>
            {isOwner && (section === "overview" || section === "applications") && (
              <button type="button" className="button primary" onClick={() => setModal({ kind: "connect" })}>
                <Plus size={17} /> Uygulama bağla
              </button>
            )}
            {isOwner && section === "team" && (
              <button type="button" className="button primary" onClick={() => setModal({ kind: "invite" })}>
                <Plus size={17} /> Üye davet et
              </button>
            )}
          </div>

          {section === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    label: "Toplam uygulama",
                    value: apps.length,
                    icon: Blocks,
                    foot: "Bu çalışma alanında",
                    color: "teal",
                  },
                  {
                    label: "Bağlı uygulama",
                    value: connectedCount,
                    icon: Link2,
                    foot: "Örnek bağlantı durumları",
                    color: "blue",
                  },
                  {
                    label: "Ekip üyesi",
                    value: team.length,
                    icon: Users,
                    foot: "Birlikte çalışan kişiler",
                    color: "violet",
                  },
                  {
                    label: "Bekleyen kurulum",
                    value: apps.length - connectedCount,
                    icon: Clock3,
                    foot: "Bağlanmaya hazır projeler",
                    color: "amber",
                  },
                ].map(({ label, value, icon: Icon, foot, color }) => (
                  <article className="stat-card" key={label}>
                    <div className="stat-top">
                      <span>{label}</span>
                      <span className={`stat-icon ${color}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <strong className="stat-value">{value.toString().padStart(2, "0")}</strong>
                    <p>{foot}</p>
                  </article>
                ))}
              </div>
              <div className="overview-grid">
                <section className="card applications-card">
                  <div className="card-heading">
                    <div>
                      <h2>Uygulamaların</h2>
                      <p>Projelerin arasında kolayca geçiş yap.</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate("applications")}>
                      Tümünü gör <ArrowRight size={15} />
                    </button>
                  </div>
                  <ApplicationTable
                    apps={filteredApps}
                    workspaceName={currentWorkspace.name}
                    onOpen={(app) => setModal({ kind: "application", app })}
                    onClear={() => setQuery("")}
                  />
                </section>
                <section className="card checklist-card">
                  <div className="card-heading">
                    <div>
                      <h2>İlk adımlar</h2>
                      <p>Çalışma alanını hazırla.</p>
                    </div>
                    <span className="checklist-progress">2 / 3</span>
                  </div>
                  <div className="progress-track">
                    <span />
                  </div>
                  <ol className="checklist">
                    <li>
                      <span className="step-check">
                        <Check size={14} />
                      </span>
                      <div>
                        <strong>Çalışma alanını oluştur</strong>
                        <p>Ekibin için ortak bir yer.</p>
                      </div>
                    </li>
                    <li>
                      <span className="step-check">
                        <Check size={14} />
                      </span>
                      <div>
                        <strong>İlk uygulamanı bağla</strong>
                        <p>Projelerini tek yerde topla.</p>
                      </div>
                    </li>
                    <li>
                      <span className="step-pending">3</span>
                      <div>
                        <strong>Ekibini davet et</strong>
                        <p>Birlikte yönetmeye başlayın.</p>
                      </div>
                    </li>
                  </ol>
                  <button
                    type="button"
                    className="button secondary full-width"
                    onClick={() => (isOwner ? setModal({ kind: "invite" }) : navigate("team"))}
                  >
                    {isOwner ? "Davet akışını incele" : "Ekibi görüntüle"}
                    <ArrowRight size={15} />
                  </button>
                  <p className="small muted sample-note">Örnek kurulum adımları</p>
                </section>
              </div>
              <div className="overview-bottom">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Son işlemler</h2>
                      <p>Ekibinden son gelişmeler.</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate("activity")}>
                      İşlem kaydı <ArrowRight size={15} />
                    </button>
                  </div>
                  <ActivityList events={events} />
                </section>
                <section className="community-card">
                  <div className="community-mark">
                    <Blocks size={27} aria-hidden="true" />
                    <span>OPEN SOURCE · MIT</span>
                  </div>
                  <h2>
                    Bir merkez.
                    <br />
                    Daha az karmaşa.
                  </h2>
                  <p>
                    Her proje için yeniden panel kurma.
                    <br />
                    Uygulamalarını bağla, işine odaklan.
                  </p>
                  <a href="https://github.com/gokhangozukara/OpenHubPanel" target="_blank" rel="noreferrer">
                    OpenHubPanel’i keşfet <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                </section>
              </div>
            </>
          )}

          {section === "applications" && (
            <section className="card">
              <div className="card-heading">
                <div className="inline-count">
                  <h2>Tüm uygulamalar</h2>
                  <span className="count-badge">{apps.length}</span>
                </div>
                <label className="search-field">
                  <Search size={17} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Uygulamalarda ara…"
                    aria-label="Uygulamalarda ara"
                  />
                </label>
              </div>
              <ApplicationTable
                apps={filteredApps}
                workspaceName={currentWorkspace.name}
                onOpen={(app) => setModal({ kind: "application", app })}
                onClear={() => setQuery("")}
              />
            </section>
          )}

          {section === "team" && (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Çalışma alanı üyeleri</h2>
                  <p>Bu alana erişebilen örnek hesaplar.</p>
                </div>
                <span className="count-badge">{team.length} üye</span>
              </div>
              <div className="member-list">
                {team.map((member) => (
                  <div className="member-row" key={member.email}>
                    <span className={`avatar ${member.color}`}>{member.initials}</span>
                    <div>
                      <strong>{member.name}</strong>
                      <p>{member.email}</p>
                    </div>
                    <span className="role-badge">{member.role}</span>
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <ShieldCheck size={15} aria-hidden="true" />
                Üyelikler ve roller her çalışma alanında ayrı tutulur.
              </div>
            </section>
          )}

          {section === "activity" && (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Çalışma alanı geçmişi</h2>
                  <p>Örnek işlem kayıtları · Gerçek audit bağlantısı henüz etkin değil.</p>
                </div>
                <Activity size={19} aria-hidden="true" />
              </div>
              <ActivityList events={events} />
            </section>
          )}

          {section === "security" && (
            <div className="settings-grid">
              {[
                {
                  icon: KeyRound,
                  title: "İki adımlı doğrulama",
                  text: "Parolaya ek olarak authenticator kodu. Zorunlu TOTP akışı geliştirme aşamasında.",
                },
                {
                  icon: Monitor,
                  title: "Oturum yönetimi",
                  text: "Aktif cihazları görme ve erişimi iptal etme. Gerçek oturum servisi henüz etkin değil.",
                },
                {
                  icon: LockKeyhole,
                  title: "Müşteri alanı izolasyonu",
                  text: "Üyelik, uygulama ve veri erişimi çalışma alanına bağlı. İlk veritabanı sınırları otomatik testlerle doğrulanır.",
                },
                {
                  icon: CheckCheck,
                  title: "Denetim kaydı",
                  text: "Yönetim değişikliği ve işlem kaydı birlikte yazılacak. Gerçek yönetim işlemleri henüz açılmadı.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <section className="card security-card" key={title}>
                  <span className="stat-icon teal">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h2>{title}</h2>
                  <p>{text}</p>
                  <span className="role-badge">Geliştirme aşamasında</span>
                </section>
              ))}
            </div>
          )}

          {section === "settings" && (
            <div className="settings-grid">
              <section className="card settings-card">
                <h2>Görünüm</h2>
                <p>Paneli rahat çalıştığın temayla kullan.</p>
                <div className="theme-options">
                  {[
                    { id: "light", name: "Açık", icon: Sun },
                    { id: "dark", name: "Koyu", icon: Moon },
                    { id: "system", name: "Sistem", icon: Monitor },
                  ].map(({ id, name, icon: Icon }) => (
                    <button
                      type="button"
                      className={theme === id ? "theme-choice selected" : "theme-choice"}
                      key={id}
                      aria-pressed={theme === id}
                      onClick={() => changeTheme(id as Theme)}
                    >
                      <Icon size={22} />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="card settings-card">
                <h2>Çalışma alanı</h2>
                <p>{currentWorkspace.description}</p>
                <dl className="details-list">
                  <div>
                    <dt>Ad</dt>
                    <dd>{currentWorkspace.name}</dd>
                  </div>
                  <div>
                    <dt>Rolün</dt>
                    <dd>{isOwner ? "Çalışma alanı sahibi" : "Görüntüleyici"}</dd>
                  </div>
                  <div>
                    <dt>Ortam</dt>
                    <dd>Yerel tasarım önizlemesi</dd>
                  </div>
                </dl>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              OpenHubPanel <span className="version-label">v0.1 · geliştirme</span>
            </span>
            <span>All in one panel.</span>
          </footer>
        </main>
      </div>

      <dialog
        ref={dialog}
        className="panel-dialog"
        aria-labelledby="dialog-title"
        onCancel={() => setModal(null)}
        onClose={() => setModal(null)}
      >
        <div className="dialog-heading">
          <h2 id="dialog-title">
            {modal?.kind === "connect"
              ? "Uygulama bağla"
              : modal?.kind === "invite"
                ? "Ekip üyesi davet et"
                : modal?.kind === "application"
                  ? modal.app.name
                  : "Ayrıntılar"}
          </h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Pencereyi kapat"
            onClick={() => setModal(null)}
          >
            <X size={19} />
          </button>
        </div>
        {modal?.kind === "application" ? (
          <>
            <p className="muted">{modal.app.description}</p>
            <dl className="details-list">
              <div>
                <dt>Bağlantı</dt>
                <dd>
                  <Status connected={modal.app.status === "connected"} />
                </dd>
              </div>
              <div>
                <dt>Erişim</dt>
                <dd>{modal.app.permission}</dd>
              </div>
              <div>
                <dt>Kaynak</dt>
                <dd>{modal.app.resources} örnek kaynak</dd>
              </div>
            </dl>
            {modal.app.id === "content" && (
              <form
                className="panel-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice("Örnek başlık bu önizlemede güncellendi. Harici servise istek gönderilmedi.");
                  setModal(null);
                }}
              >
                <label htmlFor="sample-title">Örnek içerik başlığı</label>
                <input
                  id="sample-title"
                  value={exampleTitle}
                  onChange={(event) => setExampleTitle(event.target.value)}
                  maxLength={180}
                  required
                />
                <p className="small muted">Bu form yalnızca arayüz etkileşimini gösterir.</p>
                <button type="submit" className="button primary">
                  Örnek başlığı güncelle
                </button>
              </form>
            )}
          </>
        ) : (
          modal && (
            <form
              className="panel-form"
              onSubmit={(event) => {
                event.preventDefault();
                setNotice(
                  modal.kind === "connect"
                    ? "Bağlantı formu önizlemesi tamamlandı. Gerçek API bağlantısı kurulmadı."
                    : "Davet formu önizlemesi tamamlandı. E-posta gönderilmedi.",
                );
                setModal(null);
              }}
            >
              <p className="muted">
                {modal.kind === "connect"
                  ? "Projeni bu çalışma alanına ekle. Gerçek bağlantı servisi bir sonraki geliştirme aşamasında açılacak."
                  : "Ekip arkadaşının erişeceği rolü seç. Bu önizlemede gerçek davet gönderilmez."}
              </p>
              <label htmlFor="form-name">
                {modal.kind === "connect" ? "Uygulama adı" : "E-posta adresi"}
              </label>
              <input
                id="form-name"
                name="name"
                type={modal.kind === "invite" ? "email" : "text"}
                placeholder={modal.kind === "invite" ? "ekip@example.test" : "Örn. Müşteri sitesi"}
                required
                maxLength={100}
              />
              <label htmlFor="form-role">{modal.kind === "connect" ? "Bağlantı türü" : "Erişim rolü"}</label>
              <select id="form-role" name="role">
                {modal.kind === "connect" ? (
                  <>
                    <option>HTTP API bağlantısı</option>
                    <option>Panel bağlantı kartı</option>
                  </>
                ) : (
                  <>
                    <option>Görüntüleyici · Yalnızca okuma</option>
                    <option>Editör · İçerik düzenleme</option>
                    <option>Yönetici · Ekip ve uygulamalar</option>
                  </>
                )}
              </select>
              <div className="form-notice">
                <ShieldCheck size={16} />
                {currentWorkspace.name} · Örnek akış
              </div>
              <button type="submit" className="button primary">
                Önizlemeyi tamamla <ArrowRight size={16} />
              </button>
            </form>
          )
        )}
      </dialog>
      <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-live="polite">
        {notice && (
          <>
            <CircleCheck size={19} aria-hidden="true" />
            <span>{notice}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Bildirimi kapat"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
