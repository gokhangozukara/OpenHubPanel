import { createHash } from "node:crypto";
import { hash, verify as verifyPassword } from "@node-rs/argon2";
import { generateSecret, generateURI, verify } from "otplib";
import { toDataURL } from "qrcode";
import { digest, event, failure, limit, now, seal, state, token, transaction, unseal } from "./store";

export const sessionCookie = "__Host-hubpanel_session";
export const challengeCookie = "__Host-hubpanel_challenge";
export const csrfCookie = "__Host-hubpanel_csrf";
export const cookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "lax" as const };

type User = {
  email: string;
  password: string;
  factor: string;
  last_step: number;
  active: number;
  recovery_required: number;
};
type Challenge = {
  hash: string;
  purpose: string;
  expires: number;
  attempts: number;
  password: string | null;
  factor: string | null;
  bootstrap: string | null;
};
export function configured() {
  const db = state();
  try {
    return Boolean(db.prepare("SELECT id FROM operator_user WHERE id=1").get());
  } finally {
    db.close();
  }
}
export function requireSession(raw: string | undefined) {
  if (!raw || raw.length > 256) throw new Error("UNAUTHENTICATED");
  const db = state();
  try {
    return transaction(db, () => {
      const row = db
        .prepare(`SELECT s.hash,s.created,s.seen,u.email FROM operator_session s
        JOIN operator_user u ON u.id=1 WHERE s.hash=? AND s.revoked=0 AND u.active=1 AND u.recovery_required=0`)
        .get(digest(raw));
      if (!row || Number(row.created) + 8 * 3600 <= now() || Number(row.seen) + 15 * 60 <= now())
        throw new Error("UNAUTHENTICATED");
      db.prepare("UPDATE operator_session SET seen=? WHERE hash=?").run(now(), digest(raw));
      return { hash: String(row.hash), email: String(row.email) };
    });
  } finally {
    db.close();
  }
}
async function safePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 15 || password.length > 256)
    throw new Error("PASSWORD_LENGTH");
  // Only a SHA-1 prefix leaves the server; the full password/hash is never sent.
  const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
  const response = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, {
    headers: { "Add-Padding": "true" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("PASSWORD_CHECK_UNAVAILABLE");
  const text = await response.text();
  if (text.length > 200000) throw new Error("PASSWORD_CHECK_UNAVAILABLE");
  if (
    text.split(/\r?\n/).some((line) => line.split(":")[0] === sha.slice(5) && Number(line.split(":")[1]) > 0)
  )
    throw new Error("PASSWORD_COMPROMISED");
  return hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
async function enrollment(
  purpose: "setup" | "recovery" | "manual",
  password: string | null,
  bootstrap: string | null,
) {
  const raw = token();
  const secret = generateSecret();
  const db = state();
  try {
    transaction(db, () => {
      if (purpose === "setup" || purpose === "manual") {
        const row = db
          .prepare("SELECT hash FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>?")
          .get(bootstrap, now());
        const user = db.prepare("SELECT recovery_required FROM operator_user WHERE id=1").get();
        if (!row || (purpose === "setup" ? Boolean(user) : user?.recovery_required !== 1))
          throw new Error("INVALID_BOOTSTRAP");
      }
      if (purpose === "recovery" || purpose === "manual")
        db.prepare("DELETE FROM operator_challenge WHERE purpose IN ('recovery','manual')").run();
      db.prepare(
        "INSERT INTO operator_challenge(hash,purpose,expires,password,factor,bootstrap) VALUES(?,?,?,?,?,?)",
      ).run(digest(raw), purpose, now() + 300, password, seal(secret, "totp"), bootstrap);
      event(db, `${purpose}.started`);
    });
  } finally {
    db.close();
  }
  const email = process.env.OPERATOR_EMAIL;
  if (!email) throw new Error("INVALID_OPERATOR_EMAIL");
  const uri = generateURI({ issuer: "OpenHubPanel", label: email, secret });
  return { challenge: raw, secret, qr: await toDataURL(uri, { width: 240, margin: 2 }), phase: "enroll" };
}
export async function beginSetup(bootstrap: unknown, password: unknown, manual = false) {
  limit("setup", 10, 900);
  if (typeof bootstrap !== "string" || bootstrap.length > 256 || (!manual && configured()))
    throw new Error("INVALID_BOOTSTRAP");
  const db = state();
  try {
    if (
      !db
        .prepare("SELECT hash FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>?")
        .get(digest(bootstrap), now())
    )
      throw new Error("INVALID_BOOTSTRAP");
  } finally {
    db.close();
  }
  return enrollment(manual ? "manual" : "setup", await safePassword(password), digest(bootstrap));
}
export async function beginLogin(email: unknown, password: unknown) {
  limit("password.account", 10, 900);
  const db = state();
  let user: User | undefined;
  try {
    user = db.prepare("SELECT * FROM operator_user WHERE id=1").get() as User | undefined;
  } finally {
    db.close();
  }
  if (
    !user?.active ||
    user.recovery_required !== 0 ||
    typeof email !== "string" ||
    email.toLowerCase() !== user.email ||
    typeof password !== "string" ||
    password.length > 256 ||
    !(await verifyPassword(user.password, password))
  ) {
    failure("password.failed");
    throw new Error("INVALID_CREDENTIALS");
  }
  const raw = token();
  const writer = state();
  const verifiedUser = user;
  try {
    transaction(writer, () => {
      if (
        !writer
          .prepare(
            "SELECT id FROM operator_user WHERE id=1 AND active=1 AND recovery_required=0 AND password=? AND factor=?",
          )
          .get(verifiedUser.password, verifiedUser.factor)
      )
        throw new Error("INVALID_CREDENTIALS");
      writer
        .prepare("INSERT INTO operator_challenge(hash,purpose,expires) VALUES(?,?,?)")
        .run(digest(raw), "login", now() + 300);
      event(writer, "password.verified");
    });
  } finally {
    writer.close();
  }
  return { challenge: raw, phase: "verify" };
}
export async function totpStep(secret: string, code: unknown) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new Error("INVALID_CODE");
  const result = await verify({ secret, token: code, epochTolerance: 30 });
  if (!result.valid || !("timeStep" in result)) throw new Error("INVALID_CODE");
  return Number(result.timeStep);
}
export async function finishChallenge(raw: string | undefined, code: unknown) {
  limit("factor.account", 15, 900);
  const db = state();
  let challenge: Challenge | undefined;
  let user: User | undefined;
  try {
    challenge = db
      .prepare("SELECT * FROM operator_challenge WHERE hash=? AND expires>? AND attempts<5")
      .get(digest(raw ?? ""), now()) as Challenge | undefined;
    user = db.prepare("SELECT * FROM operator_user WHERE id=1").get() as User | undefined;
    if (!challenge) throw new Error("CHALLENGE_EXPIRED");
    db.prepare("UPDATE operator_challenge SET attempts=attempts+1 WHERE hash=?").run(challenge.hash);
  } finally {
    db.close();
  }
  const factor = challenge.factor ?? user?.factor;
  if (!factor) throw new Error("INVALID_CODE");
  let step: number;
  try {
    step = await totpStep(unseal(factor, "totp"), code);
  } catch {
    failure("factor.failed");
    throw new Error("INVALID_CODE");
  }
  const session = token();
  const codes = challenge.purpose !== "login" ? Array.from({ length: 8 }, token) : [];
  const writer = state();
  try {
    transaction(writer, () => {
      const current = writer
        .prepare("SELECT * FROM operator_challenge WHERE hash=? AND expires>? AND attempts<=5")
        .get(challenge.hash, now());
      if (!current) throw new Error("CHALLENGE_EXPIRED");
      if (challenge.purpose === "setup") {
        const bootstrap = writer
          .prepare("DELETE FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>? RETURNING id")
          .get(challenge.bootstrap, now());
        if (!bootstrap || configuredWithin(writer)) throw new Error("INVALID_BOOTSTRAP");
        writer
          .prepare("INSERT INTO operator_user(id,email,password,factor,last_step) VALUES(1,?,?,?,?)")
          .run(process.env.OPERATOR_EMAIL ?? "", challenge.password, factor, step);
      } else if (challenge.purpose === "recovery") {
        if (
          !writer
            .prepare(
              "UPDATE operator_user SET factor=?, last_step=? WHERE id=1 AND active=1 AND recovery_required=0 RETURNING id",
            )
            .get(factor, step)
        )
          throw new Error("CHALLENGE_EXPIRED");
        writer.prepare("UPDATE operator_session SET revoked=1").run();
      } else if (challenge.purpose === "manual") {
        if (
          !writer
            .prepare("DELETE FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>? RETURNING id")
            .get(challenge.bootstrap, now())
        )
          throw new Error("INVALID_BOOTSTRAP");
        if (
          !writer
            .prepare(
              "UPDATE operator_user SET password=?,factor=?,last_step=?,recovery_required=0 WHERE id=1 AND active=1 AND recovery_required=1 RETURNING id",
            )
            .get(challenge.password, factor, step)
        )
          throw new Error("INVALID_BOOTSTRAP");
        writer.prepare("UPDATE operator_session SET revoked=1").run();
      } else {
        if (
          !writer
            .prepare(
              "UPDATE operator_user SET last_step=? WHERE id=1 AND active=1 AND recovery_required=0 AND last_step<? AND factor=? RETURNING id",
            )
            .get(step, step, factor)
        )
          throw new Error("CODE_ALREADY_USED");
      }
      writer.prepare("DELETE FROM operator_challenge WHERE hash=?").run(challenge.hash);
      if (codes.length) {
        writer.prepare("DELETE FROM operator_recovery").run();
        for (const value of codes)
          writer.prepare("INSERT INTO operator_recovery(hash) VALUES(?)").run(digest(value));
        writer.prepare("DELETE FROM operator_challenge").run();
      }
      writer
        .prepare("INSERT INTO operator_session(hash,created,seen) VALUES(?,?,?)")
        .run(digest(session), now(), now());
      event(writer, `${challenge.purpose}.completed`);
    });
  } finally {
    writer.close();
  }
  return { session, recoveryCodes: codes };
}
function configuredWithin(db: ReturnType<typeof state>) {
  return Boolean(db.prepare("SELECT id FROM operator_user WHERE id=1").get());
}
export async function beginRecovery(raw: string | undefined, recoveryCode: unknown) {
  limit("recovery.account", 5, 900);
  if (typeof recoveryCode !== "string" || recoveryCode.length > 256) throw new Error("INVALID_CODE");
  const db = state();
  try {
    transaction(db, () => {
      const challenge = db
        .prepare(
          "SELECT hash FROM operator_challenge WHERE hash=? AND purpose='login' AND expires>? AND attempts<5",
        )
        .get(digest(raw ?? ""), now());
      if (
        !challenge ||
        !db.prepare("DELETE FROM operator_recovery WHERE hash=? RETURNING hash").get(digest(recoveryCode))
      )
        throw new Error("INVALID_CODE");
      db.prepare("DELETE FROM operator_challenge").run();
      db.prepare("UPDATE operator_session SET revoked=1").run();
      event(db, "recovery.consumed");
    });
  } finally {
    db.close();
  }
  return enrollment("recovery", null, null);
}
export function revoke(raw: string | undefined, all: boolean) {
  const session = requireSession(raw);
  const db = state();
  try {
    transaction(db, () => {
      if (all) db.prepare("UPDATE operator_session SET revoked=1").run();
      else db.prepare("UPDATE operator_session SET revoked=1 WHERE hash=?").run(session.hash);
      event(db, all ? "sessions.revoked" : "session.logout");
    });
  } finally {
    db.close();
  }
}

export async function changePassword(
  raw: string | undefined,
  currentPassword: unknown,
  password: unknown,
  code: unknown,
) {
  const session = requireSession(raw);
  limit("password.change", 5, 900);
  const db = state();
  let user: User | undefined;
  try {
    user = db.prepare("SELECT * FROM operator_user WHERE id=1 AND active=1").get() as User | undefined;
  } finally {
    db.close();
  }
  if (
    !user ||
    typeof currentPassword !== "string" ||
    currentPassword.length > 256 ||
    !(await verifyPassword(user.password, currentPassword))
  )
    throw new Error("INVALID_CREDENTIALS");
  const nextPassword = await safePassword(password);
  const step = await totpStep(unseal(user.factor, "totp"), code);
  const writer = state();
  try {
    transaction(writer, () => {
      if (
        !writer
          .prepare("SELECT hash FROM operator_session WHERE hash=? AND revoked=0 AND created>? AND seen>?")
          .get(session.hash, now() - 8 * 3600, now() - 900)
      )
        throw new Error("UNAUTHENTICATED");
      if (
        !writer
          .prepare(
            "UPDATE operator_user SET password=?,last_step=? WHERE id=1 AND active=1 AND password=? AND factor=? AND last_step<? RETURNING id",
          )
          .get(nextPassword, step, user.password, user.factor, step)
      )
        throw new Error("CODE_ALREADY_USED");
      writer.prepare("UPDATE operator_session SET revoked=1").run();
      writer.prepare("DELETE FROM operator_challenge").run();
      event(writer, "password.changed");
    });
  } finally {
    writer.close();
  }
}
