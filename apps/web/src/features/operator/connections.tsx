"use client";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/i18n/provider";

type Call = (path: string, method?: string, data?: unknown) => Promise<unknown>;
type Connection = {
  id: string;
  name: string;
  kind: "api" | "link";
  url: string;
  write_enabled: number;
  revision: string;
  disabled: number;
  status: string;
  checked: number;
};
type Installation = { origin: string; basePath: string; mode: string; applications: number };
type Article = { id: string; title: string; status: string; version: number };
function Proof({
  mfaEnabled,
  value,
  onChange,
}: {
  mfaEnabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <label className="owner-field">
      {t(mfaEnabled ? "Confirm with a new authenticator code" : "Confirm with your password")}
      <input
        type={mfaEnabled ? "text" : "password"}
        required
        inputMode={mfaEnabled ? "numeric" : "text"}
        autoComplete={mfaEnabled ? "one-time-code" : "current-password"}
        pattern={mfaEnabled ? "[0-9]{6}" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function ConnectionsPanel({
  call,
  message,
  mfaEnabled,
  onAddApplication,
  onApplications,
}: {
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
  onAddApplication: () => void;
  onApplications: () => void;
}) {
  const { t } = useLocale();
  const [data, setData] = useState<{ connections: Connection[]; installation: Installation } | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData((await call("/connections")) as typeof data);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "UNAVAILABLE");
    } finally {
      setLoading(false);
    }
  }, [call]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Connections")}</h1>
          <p>{t("Connect an API to manage supported content here, or save a shortcut to another panel.")}</p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            setAdding(true);
            setSelected(null);
          }}
        >
          {t("Add connection")}
        </button>
      </div>
      {error && (
        <p role="alert" className="owner-notice owner-error">
          {message(error)}
        </p>
      )}
      {adding ? (
        <ConnectionCreate
          call={call}
          message={message}
          mfaEnabled={mfaEnabled}
          onDone={() => {
            setAdding(false);
            void load();
          }}
        />
      ) : selected ? (
        <ConnectionDetails
          key={`${selected.id}/${selected.revision}`}
          connection={selected}
          call={call}
          message={message}
          mfaEnabled={mfaEnabled}
          onDone={() => {
            setSelected(null);
            void load();
          }}
        />
      ) : null}
      <section className="card owner-settings">
        <h2>{t("Application configuration API")}</h2>
        <p>
          {t(
            "Your panel stores application settings and publishes a configuration URL for each application.",
          )}
        </p>
        {data ? (
          <p className="owner-notice">
            {t("Connected")} · {t("{count} applications", { count: data.installation.applications })}
          </p>
        ) : (
          <p>{t("Loading…")}</p>
        )}
        <div className="pilot-actions">
          <button type="button" className="button primary" onClick={onAddApplication}>
            {t("Add application")}
          </button>
          <button type="button" className="button secondary" onClick={onApplications}>
            {t("Your applications")}
          </button>
          <button type="button" className="button secondary" disabled={loading} onClick={() => void load()}>
            {t(loading ? "Checking…" : "Test connection")}
          </button>
        </div>
      </section>
      {data && (
        <section className="card owner-settings">
          <h2>{t("Your connections")}</h2>
          {data.connections.length === 0 ? (
            <p className="muted">
              {t("No external connections yet. Add an API connection or a panel shortcut.")}
            </p>
          ) : (
            <div className="table-scroll">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>{t("Name")}</th>
                    <th>{t("Type")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.connections.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <span className="table-subtitle">{row.url}</span>
                      </td>
                      <td>{t(row.kind === "api" ? "API integration" : "Panel shortcut")}</td>
                      <td>
                        {t(
                          row.disabled
                            ? "Disabled"
                            : row.status === "connected"
                              ? "Connected"
                              : row.kind === "link"
                                ? "Shortcut"
                                : "Unavailable",
                        )}
                      </td>
                      <td>
                        {!row.disabled &&
                          (row.kind === "link" ? (
                            <a
                              className="text-button"
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("Open panel")}
                            </a>
                          ) : (
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => {
                                setSelected(row);
                                setAdding(false);
                              }}
                            >
                              {t("Manage content")}
                            </button>
                          ))}{" "}
                        {!row.disabled && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setSelected(row);
                              setAdding(false);
                            }}
                          >
                            {t("Connection settings")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {data && (
        <SetupGuide
          installation={data.installation}
          onAddApplication={onAddApplication}
          onAddConnection={() => setAdding(true)}
        />
      )}
    </>
  );
}
function ConnectionCreate({
  call,
  message,
  mfaEnabled,
  onDone,
}: {
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState({ name: "", url: "", credential: "", kind: "api", approveTarget: false });
  const [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="card owner-settings">
      <h2>{t("Add connection")}</h2>
      <form
        className="owner-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await call("/connections", "POST", {
              ...form,
              ...(mfaEnabled ? { code: proof } : { currentPassword: proof }),
            });
            setForm({ ...form, credential: "" });
            setProof("");
            onDone();
          } catch (error) {
            setError(error instanceof Error ? error.message : "UNAVAILABLE");
            setProof("");
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="owner-notice owner-error">
            {message(error)}
          </p>
        )}
        <div className="owner-field">
          <label htmlFor="connection-kind">{t("Connection type")}</label>
          <select
            id="connection-kind"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value, credential: "" })}
          >
            <option value="api">{t("API integration")}</option>
            <option value="link">{t("Panel shortcut")}</option>
          </select>
        </div>
        <label className="owner-field">
          {t("Connection name")}
          <input
            required
            maxLength={100}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="owner-field">
          {t(form.kind === "api" ? "API base URL" : "Panel URL")}
          <input
            required
            type="url"
            placeholder={
              form.kind === "api" ? "https://example.com/hubpanel/v1" : "https://panel.example.com"
            }
            maxLength={2048}
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
          />
        </label>
        {form.kind === "api" ? (
          <>
            <p className="muted">
              {t(
                "The API must implement the OpenHubPanel 1.0 health, manifest and articles endpoints. New connections start read-only.",
              )}
            </p>
            <label className="owner-field">
              {t("API access token")}
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={16}
                maxLength={1024}
                value={form.credential}
                onChange={(event) => setForm({ ...form, credential: event.target.value })}
              />
            </label>
            <label className="owner-field">
              <span>
                <input
                  required
                  type="checkbox"
                  checked={form.approveTarget}
                  onChange={(event) => setForm({ ...form, approveTarget: event.target.checked })}
                />
                {t("I approve server access to this API host using this scoped token.")}
              </span>
            </label>
          </>
        ) : (
          <p className="muted">
            {t("A shortcut opens the other panel. That panel may ask you to sign in separately.")}
          </p>
        )}
        <Proof mfaEnabled={mfaEnabled} value={proof} onChange={setProof} />
        <div className="pilot-actions">
          <button className="button primary" type="submit" disabled={busy}>
            {t(busy ? "Please wait…" : form.kind === "api" ? "Test and add connection" : "Save shortcut")}
          </button>
          <button className="button secondary" type="button" onClick={onDone} disabled={busy}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}
function ConnectionDetails({
  connection,
  call,
  message,
  mfaEnabled,
  onDone,
}: {
  connection: Connection;
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [writeEnabled, setWriteEnabled] = useState(false);
  const [proof, setProof] = useState("");
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (connection.kind !== "api") return;
    setBusy(true);
    try {
      const result = (await call(`/connections/${connection.id}`)) as {
        items: Article[];
        writeEnabled: boolean;
      };
      setItems(result.items);
      setWriteEnabled(result.writeEnabled);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "UNAVAILABLE");
    } finally {
      setBusy(false);
    }
  }, [call, connection]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="card owner-settings">
      <h2>{connection.name}</h2>
      <p className="muted">{connection.url}</p>
      {error && (
        <p role="alert" className="owner-notice owner-error">
          {message(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="owner-notice">
          {t(notice)}
        </p>
      )}
      {connection.kind === "api" && (
        <>
          <div className="pilot-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={() => void load()}>
              {t("Refresh content")}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setAction(writeEnabled ? "disable-writes" : "enable-writes")}
            >
              {t(writeEnabled ? "Disable title changes" : "Enable title changes")}
            </button>
          </div>
          <p className="muted">
            {t(
              writeEnabled
                ? "Title changes are enabled for this connection."
                : "This connection is read-only. Enable title changes separately if the API supports them.",
            )}
          </p>
          <div className="table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("Title")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Version")}</th>
                  <th>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((article) => (
                  <tr key={article.id}>
                    <td>{article.title}</td>
                    <td>{article.status}</td>
                    <td>{article.version}</td>
                    <td>
                      {writeEnabled && (
                        <button className="text-button" type="button" onClick={() => setSelected(article)}>
                          {t("Edit title")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <ArticleEditor
              key={selected.id}
              article={selected}
              connection={connection}
              call={call}
              message={message}
              mfaEnabled={mfaEnabled}
              onDone={() => {
                setSelected(null);
                void load();
              }}
            />
          )}
        </>
      )}
      <div className="pilot-actions">
        <button className="button secondary" type="button" onClick={() => setAction("disable")}>
          {t("Disable connection")}
        </button>
        <button className="button secondary" type="button" onClick={onDone}>
          {t("Back to connections")}
        </button>
      </div>
      {action && (
        <form
          className="owner-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = (await call(`/connections/${connection.id}`, "PATCH", {
                action,
                revision: connection.revision,
                ...(mfaEnabled ? { code: proof } : { currentPassword: proof }),
              })) as { remoteKeyRevocationRequired: boolean };
              if (result.remoteKeyRevocationRequired) {
                setNotice("Connection disabled locally. Revoke its API token at the remote service.");
                setAction("");
              } else onDone();
            } catch (error) {
              setError(error instanceof Error ? error.message : "UNAVAILABLE");
            } finally {
              setBusy(false);
              setProof("");
            }
          }}
        >
          <p>
            {t(
              action === "disable"
                ? "Disable local access to this connection? The remote application and its data will remain."
                : action === "enable-writes"
                  ? "Allow title changes through this API?"
                  : "Return this connection to read-only access?",
            )}
          </p>
          <Proof mfaEnabled={mfaEnabled} value={proof} onChange={setProof} />
          <button type="submit" className="button primary" disabled={busy}>
            {t("Confirm")}
          </button>
        </form>
      )}
    </section>
  );
}
function ArticleEditor({
  article,
  connection,
  call,
  message,
  mfaEnabled,
  onDone,
}: {
  article: Article;
  connection: Connection;
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
  onDone: () => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState(article.title);
  const [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    title: string;
    expectedVersion: number;
    requestId: string;
    connectionRevision: string;
  } | null>(null);
  const [unknown, setUnknown] = useState(false);
  return (
    <form
      className="owner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const value = pending ?? {
          title,
          expectedVersion: article.version,
          requestId: crypto.randomUUID(),
          connectionRevision: connection.revision,
        };
        setPending(value);
        try {
          await call(`/connections/${connection.id}/articles/${article.id}`, "PATCH", {
            ...value,
            ...(mfaEnabled ? { code: proof } : { currentPassword: proof }),
          });
          onDone();
        } catch (error) {
          const name = error instanceof Error ? error.message : "UNKNOWN_OUTCOME";
          setError(name);
          if (["UNKNOWN_OUTCOME", "UNAVAILABLE"].includes(name)) setUnknown(true);
          else setPending(null);
        } finally {
          setBusy(false);
          setProof("");
        }
      }}
    >
      <h3>{t("Edit title")}</h3>
      {error && (
        <p role="alert" className="owner-notice owner-error">
          {message(error)}
        </p>
      )}
      <label className="owner-field">
        {t("Title")}
        <input
          required
          maxLength={180}
          value={title}
          disabled={busy || unknown || error === "CONFLICT"}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      {!unknown && <Proof mfaEnabled={mfaEnabled} value={proof} onChange={setProof} />}
      <div className="pilot-actions">
        <button className="button primary" type="submit" disabled={busy || error === "CONFLICT"}>
          {t(busy ? "Please wait…" : unknown ? "Check save result" : "Save changes")}
        </button>
        <button className="button secondary" type="button" disabled={busy} onClick={onDone}>
          {t("Close")}
        </button>
      </div>
    </form>
  );
}
function SetupGuide({
  installation,
  onAddApplication,
  onAddConnection,
}: {
  installation: Installation;
  onAddApplication: () => void;
  onAddConnection: () => void;
}) {
  const { t } = useLocale();
  return (
    <section className="card owner-settings">
      <h2>{t("Getting started")}</h2>
      <ol>
        <li>
          <strong>{t("Activate your owner account")}</strong>
          <p>{t("Completed. Your account controls this installation.")}</p>
        </li>
        <li>
          <strong>{t("Add your first application")}</strong>
          <p>{t("Choose a name and unique ID. Then copy its configuration URL into your app.")}</p>
          <button type="button" className="button secondary" onClick={onAddApplication}>
            {t("Add application")}
          </button>
        </li>
        <li>
          <strong>{t("Connect an existing service")}</strong>
          <p>
            {t(
              "Use an API integration for supported content management, or a panel shortcut for external tools.",
            )}
          </p>
          <button type="button" className="button secondary" onClick={onAddConnection}>
            {t("Add connection")}
          </button>
        </li>
      </ol>
      <details>
        <summary>{t("Install a new independent panel")}</summary>
        <p>
          {t(
            "A new installation starts with its own owner account and an empty application list. It does not need this installation or the old panel.",
          )}
        </p>
        <p>{t("After building the Linux release, run its setup command on your server:")}</p>
        <pre className="integration-code">
          node setup.mjs --origin=https://panel.example.com --email=owner@example.com
          --state=/var/lib/openhubpanel
        </pre>
        <p>
          {t(
            "Setup creates private keys and the activation link. Configure HTTPS with the generated reverse-proxy example, then start the panel using the printed command.",
          )}
        </p>
      </details>
      <p className="muted">
        {t("This installation")}: {installation.origin}
        {installation.basePath} ·{" "}
        {t(installation.mode === "standalone" ? "Independent storage" : "Existing application storage")}
      </p>
    </section>
  );
}
