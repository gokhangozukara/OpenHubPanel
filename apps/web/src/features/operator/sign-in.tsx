"use client";
import { Blocks } from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageSelector, useLocale } from "@/i18n/provider";
import { CharacterPicker } from "./character-picker";

type Call = (path: string, method?: string, data?: unknown) => Promise<unknown>;
type Result = {
  phase: "password" | "verify" | "enroll" | "complete";
  secret?: string;
  qr?: string;
  recoveryCodes?: string[];
};
export function SignIn({
  status,
  error: initialError,
  message,
  call,
  ready,
  basePath,
}: {
  status: { configured: boolean; email: string } | null;
  error: string;
  message: (code: string) => string;
  call: Call;
  ready: boolean;
  basePath: string;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [character, setCharacter] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [code, setCode] = useState("");
  const [bootstrap, setBootstrap] = useState("");
  const [manual, setManual] = useState(false);
  const [phase, setPhase] = useState("character");
  const [enrollment, setEnrollment] = useState<{ secret: string; qr: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recover, setRecover] = useState(false);
  const setup = Boolean(status && (!status.configured || manual));
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(location.hash.slice(1)),
        value = params.get("bootstrap");
      if (value) {
        setBootstrap(value);
        setManual(params.get("recovery") === "1");
        history.replaceState(null, "", location.pathname);
      }
    };
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (status && !status.configured) setName(status.email.split("@")[0] ?? "");
  }, [status]);
  async function choose(value: string) {
    setBusy(true);
    setError("");
    try {
      if (!setup) await call("/auth/character", "POST", { character: value });
      setCharacter(value);
      setPhase("password");
    } catch (value) {
      setError(value instanceof Error ? value.message : "UNAVAILABLE");
    } finally {
      setBusy(false);
    }
  }
  function completed(result: Result) {
    setCode("");
    setEnrollment(null);
    if (result.recoveryCodes?.length) {
      setRecoveryCodes(result.recoveryCodes);
      setPhase("codes");
    } else location.assign(`${basePath}/live`);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (phase === "password") {
        const result = (await call(
          manual ? "/auth/manual" : setup ? "/auth/setup" : "/auth/login",
          "POST",
          setup
            ? { bootstrap, password, username: name, character, mfaEnabled }
            : { username: name, password },
        )) as Result;
        setPassword("");
        if (result.phase === "complete") completed(result);
        else {
          setPhase(result.phase);
          if (result.secret && result.qr) setEnrollment({ secret: result.secret, qr: result.qr });
        }
      } else if (recover) {
        const result = (await call("/auth/recover", "POST", { code })) as Result;
        setCode("");
        setRecover(false);
        setEnrollment({ secret: result.secret ?? "", qr: result.qr ?? "" });
        setPhase("enroll");
      } else completed((await call("/auth/verify", "POST", { code })) as Result);
    } catch (value) {
      const name = value instanceof Error ? value.message : "UNAVAILABLE";
      setError(name);
      setPassword("");
      if (name === "CHARACTER_REQUIRED") {
        setPhase("character");
        setCharacter("");
      }
    } finally {
      setBusy(false);
    }
  }
  const heading =
    phase === "character"
      ? setup
        ? "Choose your sign-in character"
        : "Choose your character"
      : phase === "codes"
        ? "Save your recovery codes"
        : phase === "enroll"
          ? "Set up your authenticator"
          : phase === "verify"
            ? "Verify your identity"
            : setup
              ? "Activate your live account"
              : "Sign in";
  return (
    <main className="panel" data-theme="light">
      <section className="card owner-auth">
        <div className="pilot-topbar">
          <span className="brand">
            <Blocks size={22} />
            OpenHubPanel
          </span>
          <LanguageSelector />
        </div>
        <h1>{t(heading)}</h1>
        {(error || initialError) && (
          <p className="owner-notice owner-error" role="alert">
            {message(error || initialError)}
          </p>
        )}
        {!status ? (
          <p role="status">{t("Loading…")}</p>
        ) : phase === "character" ? (
          <>
            <p className="muted">
              {t(
                setup
                  ? "Remember your character. You will select it before entering your username and password."
                  : "Select your character to continue to username and password.",
              )}
            </p>
            <CharacterPicker disabled={busy || !ready} value={character} onSelect={choose} />
          </>
        ) : phase === "codes" ? (
          <>
            <p className="owner-notice">
              {t(
                "Keep these codes somewhere safe. Each code can only be used once to replace a lost authenticator.",
              )}
            </p>
            <div className="owner-codes">
              {recoveryCodes.map((value) => (
                <code className="owner-code" key={value}>
                  {value}
                </code>
              ))}
            </div>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setRecoveryCodes([]);
                location.assign(`${basePath}/live`);
              }}
            >
              {t("I saved my codes. Open my panel")}
            </button>
          </>
        ) : (
          <form className="owner-form" onSubmit={submit}>
            {phase === "password" ? (
              <>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setPhase("character");
                    setPassword("");
                  }}
                >
                  {t("Change character")}
                </button>
                {setup && !bootstrap && (
                  <label className="owner-field">
                    {t("Activation token")}
                    <input
                      required
                      autoComplete="off"
                      value={bootstrap}
                      onChange={(e) => setBootstrap(e.target.value)}
                    />
                  </label>
                )}
                <label className="owner-field">
                  {t("Username")}
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={128}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="owner-field">
                  {t(setup ? "Choose a password (at least 6 characters)" : "Password")}
                  <input
                    type="password"
                    autoComplete={setup ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    maxLength={256}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                {setup && (
                  <label className="owner-field">
                    <span>{t("Google Authenticator on every sign-in (optional)")}</span>
                    <input
                      type="checkbox"
                      checked={mfaEnabled}
                      onChange={(e) => setMfaEnabled(e.target.checked)}
                    />
                  </label>
                )}
              </>
            ) : (
              <>
                {enrollment && (
                  <>
                    <p>
                      {t(
                        "Scan this code in Google Authenticator or another authenticator app, then enter its six-digit code.",
                      )}
                    </p>
                    {/* biome-ignore lint/performance/noImgElement: Enrollment QR stays in a private data URI. */}
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
                  </>
                )}
                <label className="owner-field">
                  {t(recover ? "Recovery code" : "Authenticator code")}
                  <input
                    autoComplete="one-time-code"
                    inputMode={recover ? "text" : "numeric"}
                    pattern={recover ? undefined : "[0-9]{6}"}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              </>
            )}
            <button className="button primary" type="submit" disabled={busy || !ready}>
              {t(busy ? "Please wait…" : phase === "password" ? "Continue" : "Verify and continue")}
            </button>
            {phase === "verify" && (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setRecover(!recover);
                  setCode("");
                }}
              >
                {t(recover ? "Use authenticator" : "Use a recovery code")}
              </button>
            )}
            {phase !== "password" && <a href={`${basePath}/live`}>{t("Start again")}</a>}
          </form>
        )}
      </section>
    </main>
  );
}
