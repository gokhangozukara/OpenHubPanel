"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileText,
  KeyRound,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSelector, useLocale } from "@/i18n/provider";
import { CommandSearch } from "./command-search";
import { activities, applications, members, type PreviewApplication, workspaces } from "./fixtures";
import { useMediaQuery } from "./use-media-query";

const sections = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "applications", name: "Applications", icon: Blocks },
  { id: "team", name: "Team members", icon: Users },
  { id: "activity", name: "Activity log", icon: Activity },
  { id: "security", name: "Security", icon: ShieldCheck },
  { id: "settings", name: "Settings", icon: Settings2 },
] as const;
type Section = (typeof sections)[number]["id"];
type Modal =
  | { kind: "connect" }
  | { kind: "invite" }
  | { kind: "application"; app: PreviewApplication }
  | null;
type Theme = "light" | "dark" | "system";

function Status({ connected }: { connected: boolean }) {
  const { t } = useLocale();
  return (
    <span className={`status ${connected ? "success" : "waiting"}`}>
      <span className="status-dot" />
      {connected ? t("Connected") : t("Setup pending")}
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
  const { t } = useLocale();
  return (
    <div className="table-scroll">
      <table className="app-table">
        <caption className="sr-only">{t("Sample applications in {name}", { name: workspaceName })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Application")}</th>
            <th scope="col">{t("Status")}</th>
            <th scope="col">{t("Access")}</th>
            <th scope="col">{t("Last checked")}</th>
            <th scope="col">
              <span className="sr-only">{t("Details")}</span>
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
                    <strong>{t(app.name)}</strong>
                    <span className="table-subtitle">{t(app.category)}</span>
                  </span>
                </button>
              </td>
              <td>
                <Status connected={app.status === "connected"} />
              </td>
              <td className="muted">{t(app.permission)}</td>
              <td className="muted">{t(app.updated)}</td>
              <td>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("{name} details", { name: t(app.name) })}
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
          <h3>{t("No applications found")}</h3>
          <p>{t("Try searching for another name.")}</p>
          <button type="button" className="button secondary" onClick={onClear}>
            {t("Clear search")}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityList({ events }: { events: (typeof activities)[number][] }) {
  const { t } = useLocale();
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
            <strong>{t(event.title)}</strong>
            <p>{t(event.detail)}</p>
          </div>
          <time>{t(event.time)}</time>
        </li>
      ))}
    </ol>
  );
}

export function PreviewPanel() {
  const { t, locale } = useLocale();
  const [section, setSection] = useState<Section>("overview");
  const [workspace, setWorkspace] = useState("atlas");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [theme, setTheme] = useState<Theme>("light");
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const mobile = useMediaQuery("(max-width: 850px)");
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [exampleTitle, setExampleTitle] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const currentWorkspace = workspaces.find((item) => item.id === workspace) ?? workspaces[0];
  const apps = applications.filter((app) => app.workspace === workspace);
  const filteredApps = apps.filter(
    (app) =>
      (statusFilter === "all" || app.status === statusFilter) &&
      `${t(app.name)} ${t(app.category)}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)),
  );
  const team = members.filter((member) => member.workspace === workspace);
  const events = activities.filter((event) => event.workspace === workspace);
  const isOwner = workspace === "atlas";
  const connectedCount = apps.filter((app) => app.status === "connected").length;

  useEffect(() => {
    if (!mobile || !mobileOpen) return;
    sidebar.current?.querySelector<HTMLButtonElement>("nav button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      menuToggle.current?.focus();
    };
  }, [mobile, mobileOpen]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("openhubpanel.sidebar") === "collapsed");
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

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !modal) {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [modal]);

  function toggleSidebar() {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("openhubpanel.sidebar", collapsed ? "expanded" : "collapsed");
    } catch {
      /* Optional display preference. */
    }
  }
  function openApplication(app: PreviewApplication) {
    setMobileOpen(false);
    setModal({ kind: "application", app });
  }

  function navigate(next: Section) {
    setSection(next);
    setQuery("");
    setStatusFilter("all");
    setMobileOpen(false);
    setNotice("");
  }
  function changeWorkspace(next: string) {
    setWorkspace(next);
    setQuery("");
    setStatusFilter("all");
    setModal(null);
    setNotice("");
    setExampleTitle(null);
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
    <div className="panel" data-theme={theme} data-sidebar={collapsed && !mobile ? "collapsed" : "expanded"}>
      <a href="#main-content" className="skip-link">
        {t("Skip to content")}
      </a>
      {mobile && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t("Close menu")}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        inert={mobile && !mobileOpen}
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label={t("Main menu")}
      >
        <a href="/" className="brand" aria-label="OpenHubPanel">
          <span className="brand-symbol">
            <Blocks size={21} aria-hidden="true" />
          </span>
          <span>OpenHubPanel</span>
        </a>
        <div className="workspace-control">
          <span className="workspace-avatar">{currentWorkspace.initials}</span>
          <div>
            <label htmlFor="workspace">{t("Workspace")}</label>
            <select
              id="workspace"
              value={workspace}
              onChange={(event) => changeWorkspace(event.target.value)}
            >
              {workspaces.map((item) => (
                <option value={item.id} key={item.id}>
                  {t(item.name)}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <nav aria-label={t("Navigation")}>
          {[
            { name: "General", ids: ["overview"] },
            { name: "Workspace", ids: ["applications", "team"] },
            { name: "System", ids: ["activity", "security", "settings"] },
          ].map((group) => (
            <div className="nav-group" key={group.name}>
              <p className="nav-heading">{t(group.name)}</p>
              {sections
                .filter(({ id }) => group.ids.includes(id))
                .map(({ id, name, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => navigate(id)}
                    className={`nav-item ${section === id ? "active" : ""}`}
                    aria-label={t(name)}
                    title={collapsed ? t(name) : undefined}
                    aria-current={section === id ? "page" : undefined}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{t(name)}</span>
                    {id === "applications" && <span className="nav-count">{apps.length}</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <section className="application-shortcuts" aria-label={t("Application shortcuts")}>
          <p className="nav-heading">{t("Your applications")}</p>
          {apps.map((app) => (
            <button
              type="button"
              className="nav-item"
              key={app.id}
              title={t(app.name)}
              aria-label={t("Open {name}", { name: t(app.name) })}
              onClick={() => openApplication(app)}
            >
              <span className="shortcut-initials" aria-hidden="true">
                {app.initials}
              </span>
              <span className="shortcut-name">{t(app.name)}</span>
              <span
                className={`connection-dot ${app.status === "connected" ? "connected" : "pending"}`}
                aria-hidden="true"
              />
            </button>
          ))}
        </section>
        <div className="sidebar-bottom">
          <a
            className="sidebar-docs"
            aria-label={t("Documentation")}
            href="https://github.com/gokhangozukara/OpenHubPanel#readme"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={17} aria-hidden="true" /> <span>{t("Documentation")}</span>{" "}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <div className="sidebar-profile">
            <span className="avatar teal">DA</span>
            <div>
              <strong>{t("Demo Admin")}</strong>
              <span>{isOwner ? t("Workspace owner") : t("Viewer")}</span>
            </div>
            <span className="online-dot" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="main-shell" inert={mobile && mobileOpen}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              ref={menuToggle}
              type="button"
              aria-label={t("Open menu")}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <Menu size={21} />
            </button>
            <button
              type="button"
              className="icon-button desktop-toggle"
              onClick={toggleSidebar}
              aria-label={t(collapsed ? "Expand sidebar" : "Collapse sidebar")}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
            <button
              type="button"
              className="command-trigger"
              aria-label={t("Search workspace")}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} aria-hidden="true" />
              <span>{t("Search workspace")}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-workspace" title={t(currentWorkspace.name)}>
              {t(currentWorkspace.name)}
            </span>
          </div>
          <div className="topbar-actions">
            <LanguageSelector />
            <span className="preview-label">
              <span />
              {t("Local preview")}
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label={dark ? t("Switch to light theme") : t("Switch to dark theme")}
              onClick={() => changeTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small-avatar teal" title={t("Demo Admin")}>
              DA
            </span>
          </div>
        </header>
        <main id="main-content" className="content" tabIndex={-1}>
          <div className="preview-banner">
            <CircleHelp size={15} aria-hidden="true" />
            <span>
              {t(
                "Design preview with sample data. Changes stay on this screen and never reach live applications.",
              )}
            </span>
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {section === "overview"
                  ? t("Overview")
                  : t(sections.find((item) => item.id === section)?.name ?? "")}
              </h1>
              <p>
                {section === "overview"
                  ? t("Applications and activity in {name}.", { name: t(currentWorkspace.name) })
                  : section === "applications"
                    ? t("Keep track of your connected projects and their access.")
                    : section === "team"
                      ? t("Give each person the access they need.")
                      : section === "activity"
                        ? t("See who did what in this workspace.")
                        : section === "security"
                          ? t("Security for your account and workspace.")
                          : t("Set up your workspace and choose how it looks.")}
              </p>
            </div>
            {isOwner && (section === "overview" || section === "applications") && (
              <button type="button" className="button primary" onClick={() => setModal({ kind: "connect" })}>
                <Plus size={17} /> {t("Connect application")}
              </button>
            )}
            {isOwner && section === "team" && (
              <button type="button" className="button primary" onClick={() => setModal({ kind: "invite" })}>
                <Plus size={17} /> {t("Invite member")}
              </button>
            )}
          </div>

          {section === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    label: "Total applications",
                    value: apps.length,
                    icon: Blocks,
                    foot: "In this workspace",
                    color: "teal",
                  },
                  {
                    label: "Connected applications",
                    value: connectedCount,
                    icon: Link2,
                    foot: "Sample connection statuses",
                    color: "blue",
                  },
                  {
                    label: "Team members",
                    value: team.length,
                    icon: Users,
                    foot: "People working together",
                    color: "violet",
                  },
                  {
                    label: "Pending setup",
                    value: apps.length - connectedCount,
                    icon: Clock3,
                    foot: "Projects ready to connect",
                    color: "amber",
                  },
                ].map(({ label, value, icon: Icon, foot, color }) => (
                  <article className="stat-card" key={label}>
                    <div className="stat-top">
                      <span>{t(label)}</span>
                      <span className={`stat-icon ${color}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                    </div>
                    <strong className="stat-value">{value}</strong>
                    <p>{t(foot)}</p>
                  </article>
                ))}
              </div>
              <div className="overview-grid">
                <section className="card applications-card">
                  <div className="card-heading">
                    <div>
                      <h2>{t("Your applications")}</h2>
                      <p>{t("Move between your projects with ease.")}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate("applications")}>
                      {t("View all")} <ArrowRight size={15} />
                    </button>
                  </div>
                  <ApplicationTable
                    apps={filteredApps}
                    workspaceName={t(currentWorkspace.name)}
                    onOpen={(app) => setModal({ kind: "application", app })}
                    onClear={() => {
                      setQuery("");
                      setStatusFilter("all");
                    }}
                  />
                </section>
                <section className="card attention-card">
                  <div className="card-heading">
                    <div>
                      <h2>{t("Needs attention")}</h2>
                      <p>{t("Finish setting up your applications.")}</p>
                    </div>
                  </div>
                  {apps
                    .filter((app) => app.status !== "connected")
                    .map((app) => (
                      <div className="attention-item" key={app.id}>
                        <span className={`app-icon ${app.color}`}>{app.initials}</span>
                        <div>
                          <strong>{t(app.name)}</strong>
                          <p>{t("Setup pending")}</p>
                        </div>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={t("Review {name}", { name: t(app.name) })}
                          onClick={() => openApplication(app)}
                        >
                          <ArrowRight size={17} />
                        </button>
                      </div>
                    ))}
                  {apps.every((app) => app.status === "connected") && (
                    <p className="attention-empty">
                      <CircleCheck size={18} />
                      {t("All applications are connected.")}
                    </p>
                  )}
                  <div className="attention-team">
                    <Users size={17} />
                    <span>{t("People working together")}</span>
                    <button className="text-button" type="button" onClick={() => navigate("team")}>
                      {t("View team")}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="overview-bottom">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>{t("Recent activity")}</h2>
                      <p>{t("The latest from your team.")}</p>
                    </div>
                    <button type="button" className="text-button" onClick={() => navigate("activity")}>
                      {t("Activity log")} <ArrowRight size={15} />
                    </button>
                  </div>
                  <ActivityList events={events} />
                </section>
              </div>
            </>
          )}

          {section === "applications" && (
            <section className="card">
              <div className="card-heading">
                <div className="inline-count">
                  <h2>{t("All applications")}</h2>
                  <span className="count-badge">{apps.length}</span>
                </div>
                <div className="application-filters">
                  <select
                    aria-label={t("Filter by connection")}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">{t("All statuses")}</option>
                    <option value="connected">{t("Connected")}</option>
                    <option value="pending">{t("Setup pending")}</option>
                  </select>
                  <label className="search-field">
                    <Search size={17} aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("Search applications…")}
                      aria-label={t("Search applications")}
                    />
                  </label>
                </div>
              </div>
              <ApplicationTable
                apps={filteredApps}
                workspaceName={t(currentWorkspace.name)}
                onOpen={(app) => setModal({ kind: "application", app })}
                onClear={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
              />
            </section>
          )}

          {section === "team" && (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>{t("Workspace members")}</h2>
                  <p>{t("Sample accounts with access to this workspace.")}</p>
                </div>
                <span className="count-badge">
                  {t(team.length === 1 ? "{count} member" : "{count} members", { count: team.length })}
                </span>
              </div>
              <div className="member-list">
                {team.map((member) => (
                  <div className="member-row" key={member.email}>
                    <span className={`avatar ${member.color}`}>{member.initials}</span>
                    <div>
                      <strong>{t(member.name)}</strong>
                      <p>{member.email}</p>
                    </div>
                    <span className="role-badge">{t(member.role)}</span>
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <ShieldCheck size={15} aria-hidden="true" />
                {t("Memberships and roles are separate for each workspace.")}
              </div>
            </section>
          )}

          {section === "activity" && (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>{t("Workspace history")}</h2>
                  <p>{t("Sample events · Live audit logging is not connected yet.")}</p>
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
                  title: "Two-factor authentication",
                  text: "An authenticator code alongside your password. Required TOTP is still being built.",
                },
                {
                  icon: Monitor,
                  title: "Session management",
                  text: "Review active devices and revoke access. The session service is not enabled yet.",
                },
                {
                  icon: LockKeyhole,
                  title: "Workspace isolation",
                  text: "Memberships, applications, and data belong to a workspace. Initial database boundaries have automated tests.",
                },
                {
                  icon: CheckCheck,
                  title: "Audit trail",
                  text: "Management changes and their audit events will be saved together. Live management is not enabled yet.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <section className="card security-card" key={title}>
                  <span className="stat-icon teal">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h2>{t(title)}</h2>
                  <p>{t(text)}</p>
                  <span className="role-badge">{t("In development")}</span>
                </section>
              ))}
            </div>
          )}

          {section === "settings" && (
            <div className="settings-grid">
              <section className="card settings-card">
                <h2>{t("Appearance")}</h2>
                <p>{t("Choose the theme that suits you.")}</p>
                <div className="theme-options">
                  {[
                    { id: "light", name: "Light", icon: Sun },
                    { id: "dark", name: "Dark", icon: Moon },
                    { id: "system", name: "System", icon: Monitor },
                  ].map(({ id, name, icon: Icon }) => (
                    <button
                      type="button"
                      className={theme === id ? "theme-choice selected" : "theme-choice"}
                      key={id}
                      aria-pressed={theme === id}
                      onClick={() => changeTheme(id as Theme)}
                    >
                      <Icon size={22} />
                      <span>{t(name)}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="card settings-card">
                <h2>{t("Workspace")}</h2>
                <p>{t(currentWorkspace.description)}</p>
                <dl className="details-list">
                  <div>
                    <dt>{t("Name")}</dt>
                    <dd>{t(currentWorkspace.name)}</dd>
                  </div>
                  <div>
                    <dt>{t("Your role")}</dt>
                    <dd>{isOwner ? t("Workspace owner") : t("Viewer")}</dd>
                  </div>
                  <div>
                    <dt>{t("Environment")}</dt>
                    <dd>{t("Local design preview")}</dd>
                  </div>
                </dl>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              OpenHubPanel <span className="version-label">{t("v0.1 · development")}</span>
            </span>
            <span>All in one panel.</span>
          </footer>
        </main>
      </div>

      <CommandSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        commands={[
          ...sections.map(({ id, name }) => ({
            id,
            label: t(name),
            group: t("Navigation"),
            run: () => navigate(id),
          })),
          ...apps.map((app) => ({
            id: app.id,
            label: t(app.name),
            group: t("Your applications"),
            run: () => openApplication(app),
          })),
        ]}
      />
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
              ? t("Connect application")
              : modal?.kind === "invite"
                ? t("Invite a team member")
                : modal?.kind === "application"
                  ? t(modal.app.name)
                  : t("Details")}
          </h2>
          <button
            className="icon-button"
            type="button"
            aria-label={t("Close dialog")}
            onClick={() => setModal(null)}
          >
            <X size={19} />
          </button>
        </div>
        {modal?.kind === "application" ? (
          <>
            <p className="muted">{t(modal.app.description)}</p>
            <dl className="details-list">
              <div>
                <dt>{t("Connection")}</dt>
                <dd>
                  <Status connected={modal.app.status === "connected"} />
                </dd>
              </div>
              <div>
                <dt>{t("Access")}</dt>
                <dd>{t(modal.app.permission)}</dd>
              </div>
              <div>
                <dt>{t("Resources")}</dt>
                <dd>
                  {t(modal.app.resources === 1 ? "{count} sample resource" : "{count} sample resources", {
                    count: modal.app.resources,
                  })}
                </dd>
              </div>
            </dl>
            {modal.app.id === "content" && (
              <form
                className="panel-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice(
                    "Sample title updated in this preview. No request was sent to an external service.",
                  );
                  setModal(null);
                }}
              >
                <label htmlFor="sample-title">{t("Sample article title")}</label>
                <input
                  id="sample-title"
                  value={exampleTitle ?? t("A fresh start: news from our team")}
                  onChange={(event) => setExampleTitle(event.target.value)}
                  maxLength={180}
                  required
                />
                <p className="small muted">{t("This form only demonstrates the interface.")}</p>
                <button type="submit" className="button primary">
                  {t("Update sample title")}
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
                    ? "Connection preview complete. No live API connection was created."
                    : "Invitation preview complete. No email was sent.",
                );
                setModal(null);
              }}
            >
              <p className="muted">
                {modal.kind === "connect"
                  ? t(
                      "Add a project to this workspace. Live connections are planned for a later development phase.",
                    )
                  : t("Choose a role for your teammate. This preview does not send invitations.")}
              </p>
              <label htmlFor="form-name">
                {modal.kind === "connect" ? t("Application name") : t("Email address")}
              </label>
              <input
                id="form-name"
                name="name"
                type={modal.kind === "invite" ? "email" : "text"}
                placeholder={modal.kind === "invite" ? "team@example.test" : t("e.g. Client website")}
                required
                maxLength={100}
              />
              <label htmlFor="form-role">
                {modal.kind === "connect" ? t("Connection type") : t("Access role")}
              </label>
              <select id="form-role" name="role">
                {modal.kind === "connect" ? (
                  <>
                    <option>{t("HTTP API connection")}</option>
                    <option>{t("Panel link")}</option>
                  </>
                ) : (
                  <>
                    <option>{t("Viewer · Read only")}</option>
                    <option>{t("Editor · Edit content")}</option>
                    <option>{t("Admin · Team and applications")}</option>
                  </>
                )}
              </select>
              <div className="form-notice">
                <ShieldCheck size={16} />
                {t("{name} · Sample flow", { name: t(currentWorkspace.name) })}
              </div>
              <button type="submit" className="button primary">
                {t("Finish preview")} <ArrowRight size={16} />
              </button>
            </form>
          )
        )}
      </dialog>
      <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-live="polite">
        {notice && (
          <>
            <CircleCheck size={19} aria-hidden="true" />
            <span>{t(notice)}</span>
            <button
              type="button"
              className="icon-button"
              aria-label={t("Dismiss notification")}
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
