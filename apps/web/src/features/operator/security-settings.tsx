"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/provider";
import { CharacterPicker } from "./character-picker";

type Profile = {
  username: string;
  character: string;
  mfaEnabled: boolean;
  ipEnabled: boolean;
  ipRules: string;
  currentIp: string;
};
type Result = { phase: string; secret?: string; qr?: string; recoveryCodes?: string[] };
type Call = (path: string, method?: string, data?: unknown) => Promise<unknown>;
export function SecuritySettings({ call, message }: { call: Call; message: (code: string) => string }) {
  const { t } = useLocale();
  const [original, setOriginal] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<Result | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    call("/auth/security")
      .then((result) => {
        if (alive) {
          setOriginal(result as Profile);
          setProfile(result as Profile);
        }
      })
      .catch((value) => {
        if (alive) setError(value instanceof Error ? value.message : "UNAVAILABLE");
      });
    return () => {
      alive = false;
    };
  }, [call]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      if (enrollment) {
        const result = (await call("/auth/verify", "POST", { code })) as Result;
        setEnrollment(null);
        setCode("");
        setCodes(result.recoveryCodes ?? []);
      } else {
        const result = (await call("/auth/security", "POST", {
          ...profile,
          currentPassword: password,
          code,
        })) as Result;
        setPassword("");
        setCode("");
        if (result.phase === "enroll") setEnrollment(result);
        else location.reload();
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "UNAVAILABLE");
    } finally {
      setBusy(false);
    }
  }
  if (!profile || !original) return <p role="status">{error ? message(error) : t("Loading…")}</p>;
  return (
    <section className="owner-security">
      <h2>{t("Sign-in settings")}</h2>
      {error && (
        <p className="owner-notice owner-error" role="alert">
          {message(error)}
        </p>
      )}
      {codes.length ? (
        <>
          <h3>{t("Save your recovery codes")}</h3>
          <div className="owner-codes">
            {codes.map((value) => (
              <code className="owner-code" key={value}>
                {value}
              </code>
            ))}
          </div>
          <button
            className="button primary"
            type="button"
            onClick={() => {
              setCodes([]);
              location.reload();
            }}
          >
            {t("I saved my codes. Open my panel")}
          </button>
        </>
      ) : (
        <form className="owner-form" onSubmit={submit}>
          {enrollment ? (
            <>
              <p>
                {t(
                  "Scan this code in Google Authenticator or another authenticator app, then enter its six-digit code.",
                )}
              </p>
              {/* biome-ignore lint/performance/noImgElement: Private local enrollment image must not go to an image optimizer. */}
              <img
                className="owner-qr"
                src={enrollment.qr}
                alt={t("Authenticator enrollment QR code")}
                width={240}
                height={240}
              />
              <details>
                <summary>{t("Enter the key manually")}</summary>
                <code className="owner-secret">{enrollment.secret}</code>
              </details>
              <label className="owner-field">
                {t("Authenticator code")}
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="owner-field">
                {t("Username")}
                <input
                  required
                  maxLength={128}
                  autoComplete="username"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                />
              </label>
              <h3>{t("Sign-in character")}</h3>
              <CharacterPicker
                disabled={busy}
                value={profile.character}
                onSelect={(character) => setProfile({ ...profile, character })}
              />
              <label className="owner-field">
                <span>{t("Google Authenticator on every sign-in (optional)")}</span>
                <input
                  type="checkbox"
                  checked={profile.mfaEnabled}
                  onChange={(e) => setProfile({ ...profile, mfaEnabled: e.target.checked })}
                />
              </label>
              <label className="owner-field">
                <span>{t("Restrict sign-in to allowed IP addresses")}</span>
                <input
                  type="checkbox"
                  checked={profile.ipEnabled}
                  onChange={(e) => setProfile({ ...profile, ipEnabled: e.target.checked })}
                />
              </label>
              <p className="muted small">
                {t("Your current IP")}: <code>{profile.currentIp}</code>
              </p>
              {profile.ipEnabled && (
                <>
                  <div className="owner-field">
                    <label htmlFor="owner-ip-rules">
                      {t("Allowed IP addresses or CIDR ranges (one per line)")}
                    </label>
                    <textarea
                      id="owner-ip-rules"
                      required
                      value={profile.ipRules}
                      onChange={(e) => setProfile({ ...profile, ipRules: e.target.value })}
                    />
                  </div>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        ipRules: [
                          ...new Set([...profile.ipRules.split("\n").filter(Boolean), profile.currentIp]),
                        ].join("\n"),
                      })
                    }
                  >
                    {t("Add my current IP")}
                  </button>
                </>
              )}
              <p className="muted small">
                {t(
                  "Saving sign-in settings signs out existing sessions. Your current IP must remain allowed.",
                )}
              </p>
              <label className="owner-field">
                {t("Current password")}
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {original.mfaEnabled && (
                <label className="owner-field">
                  {t("Confirm with a new authenticator code")}
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <button className="button primary" type="submit" disabled={busy}>
            {t(busy ? "Please wait…" : enrollment ? "Verify and continue" : "Save sign-in settings")}
          </button>
        </form>
      )}
    </section>
  );
}
