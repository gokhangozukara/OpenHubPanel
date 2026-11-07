"use client";

import {
  Activity,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { LanguageSelector, useLocale } from "@/i18n/provider";
import type { PilotApplication } from "@/server/pilot/catalog";

type Probe = { status: "checking" | "reachable" | "unavailable"; latencyMs?: number };

export function PilotPanel({
  applications,
  basePath,
}: {
  applications: PilotApplication[];
  basePath: string;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [probes, setProbes] = useState<Record<string, Probe>>({});
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = applications.filter((app) =>
    `${app.name} ${app.category}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const current = applications.find((app) => app.id === selected);

  async function check(id: string) {
    setProbes((value) => ({ ...value, [id]: { status: "checking" } }));
    try {
      const response = await fetch(`${basePath}/api/pilot/connections/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || result.status !== "reachable") throw new Error("UNAVAILABLE");
      setProbes((value) => ({ ...value, [id]: { status: "reachable", latencyMs: result.latencyMs } }));
    } catch {
      setProbes((value) => ({ ...value, [id]: { status: "unavailable" } }));
    }
  }
  async function checkAll() {
    setChecking(true);
    try {
      // Keep load bounded on the existing service.
      for (const app of applications) await check(app.id);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="pilot-shell panel" data-theme="light">
      <aside className="pilot-sidebar" aria-label={t("Your applications")}>
        <a href={`${basePath}/pilot`} className="brand">
          <Blocks size={23} />
          <span>OpenHubPanel</span>
        </a>
        <p className="nav-heading">{t("Live workspace")}</p>
        <button
          className={`nav-item ${!selected ? "active" : ""}`}
          type="button"
          onClick={() => setSelected(null)}
        >
          <Activity size={17} />
          {t("Overview")}
        </button>
        <p className="nav-heading">{t("Your applications")}</p>
        {applications.map((app) => (
          <button
            className={`nav-item ${selected === app.id ? "active" : ""}`}
            key={app.id}
            type="button"
            onClick={() => setSelected(app.id)}
          >
            {app.name}
          </button>
        ))}
        <a href="/" className="sidebar-docs">
          {t("Existing management")}
        </a>
      </aside>
      <div className="pilot-main">
        <header className="pilot-topbar">
          <span>
            OpenHubPanel <span className="muted">/ {t("Live pilot")}</span>
          </span>
          <LanguageSelector />
        </header>
        <main className="pilot-content">
          <div className="preview-banner">
            <ShieldCheck size={16} />
            <span>{t("Real application data. Existing settings and public APIs are preserved.")}</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>{current?.name ?? t("Applications")}</h1>
              <p>
                {t(
                  "Connected to the existing installation. Native authentication and team management are not enabled.",
                )}
              </p>
            </div>
            <button className="button primary" type="button" disabled={checking} onClick={checkAll}>
              {checking ? <LoaderCircle size={16} /> : <Activity size={16} />}
              {t("Check all connections")}
            </button>
          </div>
          {current ? (
            <section className="card pilot-detail">
              <h2>{current.name}</h2>
              <p className="muted">{current.category}</p>
              <dl className="details-list">
                <div>
                  <dt>{t("Version")}</dt>
                  <dd>{current.version || "—"}</dd>
                </div>
                <div>
                  <dt>{t("Package")}</dt>
                  <dd>{current.packageName}</dd>
                </div>
                <div>
                  <dt>{t("Maintenance")}</dt>
                  <dd>{t(current.maintenance ? "Enabled" : "Disabled")}</dd>
                </div>
              </dl>
              <div className="pilot-actions">
                <button className="button secondary" type="button" onClick={() => check(current.id)}>
                  {t("Test connection")}
                </button>
                <a className="button primary" href={current.legacyPath}>
                  {t("Manage application")}
                  <ArrowUpRight size={16} />
                </a>
              </div>
              <p className="muted small" role="status">
                {probes[current.id]?.status === "reachable"
                  ? t("API reachable")
                  : probes[current.id]?.status === "unavailable"
                    ? t("Connection unavailable")
                    : t("Not checked")}
              </p>
              <p className="small muted">
                {t(
                  "Management opens the existing editor. New native editing and MFA are still in development.",
                )}
              </p>
            </section>
          ) : (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>{t("Your applications")}</h2>
                  <p>{t("{count} applications", { count: applications.length })}</p>
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label={t("Search applications")}
                    placeholder={t("Search applications…")}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table className="app-table">
                  <caption className="sr-only">{t("Live application connections")}</caption>
                  <thead>
                    <tr>
                      <th>{t("Application")}</th>
                      <th>{t("Version")}</th>
                      <th>{t("Connection")}</th>
                      <th>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <button
                            className="app-name-button"
                            type="button"
                            onClick={() => setSelected(app.id)}
                          >
                            <span className="app-icon teal">{app.name.slice(0, 2)}</span>
                            <span>
                              <strong>{app.name}</strong>
                              <span className="table-subtitle">{app.category}</span>
                            </span>
                          </button>
                        </td>
                        <td>{app.version || "—"}</td>
                        <td>
                          <span className="pilot-connection" role="status">
                            {probes[app.id]?.status === "reachable" && <CheckCircle2 size={14} />}
                            {t(
                              probes[app.id]?.status === "reachable"
                                ? "API reachable"
                                : probes[app.id]?.status === "checking"
                                  ? "Checking…"
                                  : probes[app.id]?.status === "unavailable"
                                    ? "Connection unavailable"
                                    : "Not checked",
                            )}
                            {probes[app.id]?.latencyMs !== undefined && ` · ${probes[app.id]?.latencyMs} ms`}
                          </span>
                        </td>
                        <td>
                          <a className="text-button" href={app.legacyPath}>
                            {t("Manage application")}
                            <ArrowUpRight size={15} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filtered.length && <p className="empty-search">{t("No applications found")}</p>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
