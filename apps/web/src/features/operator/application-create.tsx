"use client";
import { useState } from "react";
import { useLocale } from "@/i18n/provider";

type Call = (path: string, method?: string, data?: unknown) => Promise<unknown>;
export function ApplicationCreate({
  call,
  message,
  mfaEnabled,
  onCancel,
}: {
  call: Call;
  message: (code: string) => string;
  mfaEnabled: boolean;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [form, setForm] = useState({ id: "", name: "", package: "", category: "" });
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{
    requestId: string;
    revision: string;
    values: { name: string; package: string; category: string };
    id: string;
  } | null>(null);
  const [unknown, setUnknown] = useState(false);
  return (
    <section className="card owner-settings">
      <h1>{t("Add application")}</h1>
      <p className="muted">
        {t("Create an application, configure its settings, then connect your app to its configuration URL.")}
      </p>
      {error && (
        <p className="owner-notice owner-error" role="alert">
          {message(error)}
        </p>
      )}
      <form
        className="owner-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const operation = pending ?? {
            id: form.id,
            requestId: crypto.randomUUID(),
            revision: "0".repeat(64),
            values: { name: form.name, package: form.package, category: form.category },
          };
          setPending(operation);
          try {
            await call(`/settings/${operation.id}/application`, "PUT", {
              ...operation,
              ...(mfaEnabled ? { code: proof } : { currentPassword: proof }),
            });
            location.assign(`${location.pathname}?app=${encodeURIComponent(operation.id)}&tab=application`);
          } catch (value) {
            const code = value instanceof Error ? value.message : "UNKNOWN_OUTCOME";
            setError(code);
            setProof("");
            if (["UNKNOWN_OUTCOME", "UNAVAILABLE"].includes(code)) setUnknown(true);
            else setPending(null);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="owner-grid">
          {(
            [
              ["name", "Application name", 100],
              ["id", "Application ID", 64],
              ["package", "Package or bundle ID", 200],
              ["category", "Category", 100],
            ] as const
          ).map(([key, label, max]) => (
            <label className="owner-field" key={key}>
              {t(label)}
              <input
                value={form[key]}
                required={key === "name" || key === "id"}
                disabled={busy || unknown}
                maxLength={max}
                pattern={key === "id" ? "[a-z0-9][a-z0-9-]{0,63}" : undefined}
                onChange={(event) => {
                  setForm({ ...form, [key]: event.target.value });
                  setPending(null);
                }}
              />
            </label>
          ))}
        </div>
        <p className="muted">
          {t(
            "Use a unique lowercase ID with letters, numbers and hyphens. The package or bundle ID is optional.",
          )}
        </p>
        {!unknown && (
          <label className="owner-field">
            {t(mfaEnabled ? "Confirm with a new authenticator code" : "Confirm with your password")}
            <input
              type={mfaEnabled ? "text" : "password"}
              inputMode={mfaEnabled ? "numeric" : "text"}
              autoComplete={mfaEnabled ? "one-time-code" : "current-password"}
              pattern={mfaEnabled ? "[0-9]{6}" : undefined}
              required
              value={proof}
              onChange={(event) => setProof(event.target.value)}
            />
          </label>
        )}
        <div className="pilot-actions">
          <button className="button primary" type="submit" disabled={busy}>
            {t(busy ? "Please wait…" : unknown ? "Check save result" : "Create application")}
          </button>
          <button className="button secondary" type="button" onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}
