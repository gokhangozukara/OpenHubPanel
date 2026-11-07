"use client";

import { Activity, Blocks, LogOut, Search, Settings, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LanguageSelector, useLocale } from "@/i18n/provider";
import type { PilotApplication } from "@/server/pilot/catalog";
import { SecuritySettings } from "./security-settings";
import { SignIn } from "./sign-in";

type Field = { name: string; label: string; type: string };
type Values = Record<string, string | boolean | number>;
type Configuration = { fields: Field[]; values: Values; revision: string };
type Audit = {
  security: { id: number; time: number; event: string; target: string; result: string }[];
  settings: { time: string; app: string; section: string; fields: string; request_id: string }[];
};
const sectionLabels = {
  ads: "Advertising",
  popup: "Pop-up",
  announce: "Announcements",
  update: "Versions",
  pro: "Subscriptions",
  notes: "Notes",
};
const errors: Record<string, string> = {
  CHARACTER_INCORRECT: "That is not your character. Select your character to continue.",
  CHARACTER_REQUIRED: "Select your character again before trying your password.",
  INVALID_CHARACTER: "Choose one of the eight characters.",
  INVALID_USERNAME: "Enter a username of 1 to 128 characters.",
  INVALID_IP_RULES: "Enter valid IP addresses or CIDR ranges.",
  IP_NOT_ALLOWED: "Access from this IP address is not allowed.",
  IP_WOULD_LOCK_OUT: "Your current IP must be included before enabling the restriction.",
  INVALID_CREDENTIALS: "Sign-in details are incorrect.",
  INVALID_CODE: "The code is invalid. Try the current authenticator code.",
  CODE_ALREADY_USED: "This code was already used. Wait for the next authenticator code.",
  CHALLENGE_EXPIRED: "This sign-in step expired. Start again.",
  INVALID_BOOTSTRAP:
    "The activation link expired or was already used. Request a new link from the server operator.",
  PASSWORD_LENGTH: "Use a password of 6 to 256 characters.",
  PASSWORD_COMPROMISED: "This password appears in known breaches. Choose a different password.",
  PASSWORD_CHECK_UNAVAILABLE: "The password safety check is unavailable. Try again shortly.",
  RATE_LIMITED: "Too many attempts. Wait before trying again.",
  CONFLICT: "These settings changed in another window. Reload before saving again.",
  UNKNOWN_OUTCOME: "The save result is unknown. Check the result before making another change.",
  FORBIDDEN: "The security check failed. Reload this page and try again.",
  UNAVAILABLE: "The service is unavailable. Try again shortly.",
};

export function LivePanel({
  email,
  mfaEnabled,
  applications,
  basePath,
}: {
  email: string | null;
  mfaEnabled: boolean;
  applications: PilotApplication[];
  basePath: string;
}) {
  const { t } = useLocale();
  const [csrf, setCsrf] = useState("");
  const [status, setStatus] = useState<{ configured: boolean; email: string } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [probes, setProbes] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${basePath}/api/operator/auth/status`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("UNAVAILABLE");
        const result = await response.json();
        if (alive) {
          setCsrf(result.csrf);
          setStatus(result);
        }
      })
      .catch(() => {
        if (alive) setError("UNAVAILABLE");
      });
    return () => {
      alive = false;
    };
  }, [basePath]);

  const call = useCallback(
    async (path: string, method = "GET", data?: unknown) => {
      const response = await fetch(`${basePath}/api/operator${path}`, {
        method,
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: data === undefined ? undefined : JSON.stringify(data),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({ error: "UNAVAILABLE" }));
      if ((response.status === 401 || result.error === "IP_NOT_ALLOWED") && email) {
        location.reload();
        throw new Error("UNAUTHENTICATED");
      }
      if (!response.ok) throw new Error(result.error ?? "UNAVAILABLE");
      return result;
    },
    [basePath, csrf, email],
  );
  const message = (code: string) => t(errors[code] ?? errors.UNAVAILABLE ?? "Service unavailable");
  if (!email)
    return (
      <SignIn
        status={status}
        error={error}
        message={message}
        call={call}
        ready={Boolean(csrf)}
        basePath={basePath}
      />
    );
  const current = applications.find((app) => app.id === selected);
  async function logout(all = false) {
    try {
      await call(all ? "/auth/revoke" : "/auth/logout", "POST", {});
      location.reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : "UNAVAILABLE");
    }
  }
  async function checkAll() {
    setChecking(true);
    try {
      for (const app of applications) {
        try {
          const response = await fetch(`${basePath}/api/pilot/connections/${app.id}`, { cache: "no-store" });
          setProbes((value) => ({
            ...value,
            [app.id]: response.ok ? "API reachable" : "Connection unavailable",
          }));
        } catch {
          setProbes((value) => ({ ...value, [app.id]: "Connection unavailable" }));
        }
      }
    } finally {
      setChecking(false);
    }
  }
  async function showAccount() {
    setAccount(true);
    setSelected(null);
    setError("");
    try {
      setAudit(await call("/audit"));
    } catch (value) {
      setError(value instanceof Error ? value.message : "UNAVAILABLE");
    }
  }
  return (
    <div className="pilot-shell panel" data-theme="light">
      <aside className="pilot-sidebar" aria-label={t("Your applications")}>
        <a href={`${basePath}/live`} className="brand">
          <Blocks size={23} />
          <span>OpenHubPanel</span>
        </a>
        <p className="nav-heading">{t("Your workspace")}</p>
        <button
          className={`nav-item ${!selected && !account ? "active" : ""}`}
          type="button"
          onClick={() => {
            setSelected(null);
            setAccount(false);
          }}
        >
          <Activity size={17} />
          {t("Overview")}
        </button>
        <button className={`nav-item ${account ? "active" : ""}`} type="button" onClick={showAccount}>
          <ShieldCheck size={17} />
          {t("Security and activity")}
        </button>
        <p className="nav-heading">{t("Your applications")}</p>
        {applications.map((app) => (
          <button
            className={`nav-item ${selected === app.id ? "active" : ""}`}
            key={app.id}
            type="button"
            onClick={() => {
              setSelected(app.id);
              setAccount(false);
            }}
          >
            {app.name}
          </button>
        ))}
        <a href="/studio" className="sidebar-docs">
          Studio Team
        </a>
        <a href="/legacy" className="sidebar-docs">
          {t("Existing management")}
        </a>
      </aside>
      <div className="pilot-main">
        <header className="pilot-topbar">
          <span>OpenHubPanel</span>
          <div className="owner-identity">
            <span className="muted small">{email}</span>
            <LanguageSelector />
            <button
              className="icon-button"
              type="button"
              title={t("Sign out")}
              aria-label={t("Sign out")}
              onClick={() => logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="pilot-content">
          {error && (
            <p className="owner-notice owner-error" role="alert">
              {message(error)}
            </p>
          )}
          {account ? (
            <section className="card owner-account">
              <h1>{t("Security and activity")}</h1>
              <p>{email}</p>
              <p className="muted">
                {t(
                  "Sessions expire after 15 minutes idle or 8 hours total. Configure your sign-in protection below.",
                )}
              </p>
              <button type="button" className="button secondary" onClick={() => logout(true)}>
                {t("Sign out on all devices")}
              </button>
              <PasswordForm call={call} message={message} mfaEnabled={mfaEnabled} />
              <SecuritySettings call={call} message={message} />
              <h2>{t("Configuration history")}</h2>
              <div className="table-scroll owner-audit">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>{t("Time")}</th>
                      <th>{t("Application")}</th>
                      <th>{t("Section")}</th>
                      <th>{t("Changed fields")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit?.settings.map((entry) => (
                      <tr key={entry.request_id}>
                        <td>{entry.time} UTC</td>
                        <td>{entry.app}</td>
                        <td>
                          {t(sectionLabels[entry.section as keyof typeof sectionLabels] ?? entry.section)}
                        </td>
                        <td>{JSON.parse(entry.fields).join(", ") || t("No field changes")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2>{t("Security events")}</h2>
              <div className="owner-audit">
                {audit?.security.map((entry) => (
                  <p key={entry.id}>
                    {new Date(entry.time * 1000).toLocaleString()} · {entry.event} · {entry.result}
                  </p>
                ))}
              </div>
            </section>
          ) : current ? (
            <Application
              key={current.id}
              application={current}
              call={call}
              message={message}
              mfaEnabled={mfaEnabled}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>{t("Applications")}</h1>
                  <p>{t("Your live applications, settings and activity in one place.")}</p>
                </div>
                <button className="button primary" type="button" disabled={checking} onClick={checkAll}>
                  <Activity size={16} />
                  {t(checking ? "Checking…" : "Check all connections")}
                </button>
              </div>
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
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>{t("Application")}</th>
                        <th>{t("Version")}</th>
                        <th>{t("Connection")}</th>
                        <th>{t("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications
                        .filter((app) =>
                          `${app.name} ${app.category}`
                            .toLocaleLowerCase()
                            .includes(query.toLocaleLowerCase()),
                        )
                        .map((app) => (
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
                            <td>{t(probes[app.id] ?? "Not checked")}</td>
                            <td>
                              <button
                                className="text-button"
                                type="button"
                                onClick={() => setSelected(app.id)}
                              >
                                {t("Manage application")}
                                <Settings size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

type ApiResult = Configuration &
  Audit & { phase: string; secret: string; qr: string; recoveryCodes?: string[] };
type Call = (path: string, method?: string, data?: unknown) => Promise<ApiResult>;

function PasswordForm({
  call,
  message,
  mfaEnabled,
}: {
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
}) {
  const { t } = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <details>
      <summary>{t("Change password")}</summary>
      <form
        className="owner-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await call("/auth/password", "POST", { currentPassword, password, code });
            location.reload();
          } catch (value) {
            setError(value instanceof Error ? value.message : "UNAVAILABLE");
          } finally {
            setBusy(false);
            setCurrentPassword("");
            setPassword("");
            setCode("");
          }
        }}
      >
        {error && (
          <p className="owner-notice owner-error" role="alert">
            {message(error)}
          </p>
        )}
        <label className="owner-field">
          {t("Current password")}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="owner-field">
          {t("New password")}
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mfaEnabled && (
          <label className="owner-field">
            {t("Confirm with a new authenticator code")}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        <button type="submit" disabled={busy} className="button primary">
          {t(busy ? "Please wait…" : "Change password")}
        </button>
      </form>
    </details>
  );
}
function Application({
  application,
  call,
  message,
  mfaEnabled,
}: {
  application: PilotApplication;
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
}) {
  const { t } = useLocale();
  const [section, setSection] = useState("ads");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{application.name}</h1>
          <p>
            {application.packageName} · {application.version || "—"}
          </p>
        </div>
        <a className="button secondary" href={application.legacyPath}>
          {t("Existing management")}
        </a>
      </div>
      <nav className="owner-tabs" aria-label={t("Application settings")}>
        {Object.entries(sectionLabels).map(([id, label]) => (
          <button
            type="button"
            className={`button secondary ${section === id ? "active" : ""}`}
            key={id}
            onClick={() => setSection(id)}
          >
            {t(label)}
          </button>
        ))}
        <a className="button secondary" href={`${application.legacyPath}?tab=push`}>
          {t("Push notifications")}
        </a>
        {application.id === "muzyfol" && (
          <a className="button secondary" href={`${application.legacyPath}?tab=content`}>
            {t("Music content")}
          </a>
        )}
      </nav>
      <ConfigurationForm
        mfaEnabled={mfaEnabled}
        key={`${application.id}/${section}`}
        app={application.id}
        section={section}
        call={call}
        message={message}
      />
    </>
  );
}
function ConfigurationForm({
  app,
  section,
  call,
  message,
  mfaEnabled,
}: {
  app: string;
  mfaEnabled: boolean;
  section: string;
  call: Call;
  message: (code: string) => string;
}) {
  const { t } = useLocale();
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [values, setValues] = useState<Values>({});
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ requestId: string; revision: string; values: Values } | null>(
    null,
  );
  const [unknown, setUnknown] = useState(false);
  useEffect(() => {
    let alive = true;
    call(`/settings/${app}/${section}`)
      .then((data) => {
        if (alive) {
          setConfiguration(data as Configuration);
          setValues(data.values);
        }
      })
      .catch((value) => {
        if (alive) setError(value instanceof Error ? value.message : "UNAVAILABLE");
      });
    return () => {
      alive = false;
    };
  }, [app, section, call]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!configuration) return;
    setBusy(true);
    setError("");
    setSaved(false);
    const operation = pending ?? { requestId: crypto.randomUUID(), revision: configuration.revision, values };
    setPending(operation);
    try {
      const result = await call(`/settings/${app}/${section}`, "PUT", {
        ...operation,
        ...(mfaEnabled ? { code } : { currentPassword: code }),
      });
      setConfiguration({ ...configuration, revision: result.revision });
      setPending(null);
      setUnknown(false);
      setCode("");
      setSaved(true);
    } catch (value) {
      const name = value instanceof Error ? value.message : "UNKNOWN_OUTCOME";
      setError(name);
      setCode("");
      if (name === "UNKNOWN_OUTCOME" || name === "UNAVAILABLE") setUnknown(true);
      else if (name !== "CONFLICT") setPending(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card owner-settings">
      <h2>{t(sectionLabels[section as keyof typeof sectionLabels] ?? section)}</h2>
      <p className="muted">{t("Changes apply to the live application. Review your values before saving.")}</p>
      {error && (
        <p className="owner-notice owner-error" role="alert">
          {message(error)}
        </p>
      )}
      {saved && (
        <p className="owner-notice" role="status">
          {t("Saved and recorded in the activity history.")}
        </p>
      )}
      {!configuration ? (
        <p role="status">{t("Loading…")}</p>
      ) : (
        <form className="owner-form" onSubmit={save}>
          <div className="owner-grid">
            {configuration.fields.map((field) => (
              <div className="owner-field" key={field.name}>
                <label htmlFor={`setting-${field.name}`}>{t(field.label)}</label>
                {field.type === "boolean" ? (
                  <input
                    id={`setting-${field.name}`}
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    disabled={busy || unknown}
                    onChange={(e) => {
                      setValues({ ...values, [field.name]: e.target.checked });
                      setSaved(false);
                      setPending(null);
                    }}
                  />
                ) : field.type === "multiline" ? (
                  <textarea
                    id={`setting-${field.name}`}
                    maxLength={4000}
                    disabled={busy || unknown}
                    value={String(values[field.name] ?? "")}
                    onChange={(e) => {
                      setValues({ ...values, [field.name]: e.target.value });
                      setSaved(false);
                      setPending(null);
                    }}
                  />
                ) : field.type === "frequency" ? (
                  <select
                    id={`setting-${field.name}`}
                    value={String(values[field.name])}
                    disabled={busy || unknown}
                    onChange={(e) => {
                      setValues({ ...values, [field.name]: e.target.value });
                      setSaved(false);
                      setPending(null);
                    }}
                  >
                    {["once", "daily", "always"].map((value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`setting-${field.name}`}
                    type={field.type === "integer" ? "number" : "text"}
                    min={field.type === "integer" ? 0 : undefined}
                    max={field.type === "integer" ? 1000000 : undefined}
                    maxLength={4000}
                    disabled={busy || unknown}
                    value={String(values[field.name] ?? "")}
                    onChange={(e) => {
                      setValues({
                        ...values,
                        [field.name]: field.type === "integer" ? Number(e.target.value) : e.target.value,
                      });
                      setSaved(false);
                      setPending(null);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {!unknown && (
            <label className="owner-field">
              {t(mfaEnabled ? "Confirm with a new authenticator code" : "Confirm with your password")}
              <input
                type={mfaEnabled ? "text" : "password"}
                inputMode={mfaEnabled ? "numeric" : "text"}
                autoComplete={mfaEnabled ? "one-time-code" : "current-password"}
                required
                pattern={mfaEnabled ? "[0-9]{6}" : undefined}
                value={code}
                disabled={busy}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          )}
          <div className="pilot-actions">
            <button className="button primary" type="submit" disabled={busy || error === "CONFLICT"}>
              {t(busy ? "Please wait…" : unknown ? "Check save result" : "Save changes")}
            </button>
            {error === "CONFLICT" && (
              <button className="button secondary" type="button" onClick={() => location.reload()}>
                {t("Reload")}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
