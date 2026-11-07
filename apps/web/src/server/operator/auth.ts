import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { hash, verify as verifyPassword } from "@node-rs/argon2";
import { generateSecret, generateURI, verify } from "otplib";
import { toDataURL } from "qrcode";
import {
  allowsIp,
  characterHash,
  normalizedUsername,
  parseAllowlist,
  selectedCharacter,
  username,
} from "./access";
import { digest, equal, event, failure, limit, now, seal, state, token, transaction, unseal } from "./store";

export const sessionCookie = "__Host-hubpanel_session";
export const challengeCookie = "__Host-hubpanel_challenge";
export const gateCookie = "__Host-hubpanel_character";
export const csrfCookie = "__Host-hubpanel_csrf";
export const cookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "lax" as const };
export type User = {
  email: string;
  username: string;
  password: string;
  factor: string;
  last_step: number;
  active: number;
  recovery_required: number;
  mfa_enabled: number;
  character_hash: string;
  ip_allowlist: string;
  security_version: number;
};
type Policy = { username: string; characterHash: string; ipAllowlist: string; mfaEnabled: boolean };
type Challenge = {
  hash: string;
  purpose: string;
  expires: number;
  attempts: number;
  password: string | null;
  factor: string | null;
  bootstrap: string | null;
  metadata: string;
  ip: string;
};
export type AuthResult = {
  phase: "password" | "enroll" | "verify" | "complete";
  session?: string;
  challenge?: string;
  gate?: string;
  secret?: string;
  qr?: string;
  recoveryCodes?: string[];
};
export type StepUp = {
  sessionHash: string;
  passwordHash: string;
  factor: string;
  version: number;
  step: number | null;
  ip: string;
};
function withState<T>(action: (db: DatabaseSync) => T) {
  const db = state();
  try {
    return action(db);
  } finally {
    db.close();
  }
}
function userFrom(db: DatabaseSync) {
  return db.prepare("SELECT * FROM operator_user WHERE id=1").get() as User | undefined;
}
function active(user: User | undefined, ip: string): asserts user is User {
  if (!user?.active || user.recovery_required) throw new Error("UNAUTHENTICATED");
  if (!allowsIp(user.ip_allowlist, ip)) throw new Error("IP_NOT_ALLOWED");
}
function sessionWithin(db: DatabaseSync, rawHash: string) {
  if (
    !db
      .prepare("SELECT hash FROM operator_session WHERE hash=? AND revoked=0 AND created>? AND seen>?")
      .get(rawHash, now() - 28800, now() - 900)
  )
    throw new Error("UNAUTHENTICATED");
}
function issueSession(db: DatabaseSync, ip: string) {
  const raw = token();
  db.prepare("INSERT INTO operator_session(hash,created,seen) VALUES(?,?,?)").run(digest(raw), now(), now());
  db.prepare("DELETE FROM operator_limit WHERE key=?").run(digest(`character.failed:${ip}`));
  return raw;
}
function revokeWithin(db: DatabaseSync) {
  db.prepare("UPDATE operator_session SET revoked=1").run();
  db.prepare("DELETE FROM operator_challenge").run();
}
function userPolicy(user: User): Policy {
  return {
    username: user.username || user.email,
    characterHash: user.character_hash,
    ipAllowlist: user.ip_allowlist,
    mfaEnabled: Boolean(user.mfa_enabled),
  };
}
function newPolicy(options: Record<string, unknown>): Policy {
  return {
    username: username(options.username),
    characterHash: characterHash(options.character),
    ipAllowlist: "[]",
    mfaEnabled: options.mfaEnabled !== false,
  };
}
export function configured() {
  return withState((db) => Boolean(userFrom(db)));
}
export function requireSession(raw: string | undefined, ip = "local") {
  if (!raw || raw.length > 256) throw new Error("UNAUTHENTICATED");
  return withState((db) =>
    transaction(db, () => {
      sessionWithin(db, digest(raw));
      const user = userFrom(db);
      active(user, ip);
      db.prepare("UPDATE operator_session SET seen=? WHERE hash=?").run(now(), digest(raw));
      return {
        hash: digest(raw),
        email: user.email,
        username: user.username || user.email,
        mfaEnabled: Boolean(user.mfa_enabled),
      };
    }),
  );
}
async function safePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6 || password.length > 256)
    throw new Error("PASSWORD_LENGTH");
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
async function validPassword(user: User, value: unknown) {
  return typeof value === "string" && value.length <= 256 && (await verifyPassword(user.password, value));
}
export function selectCharacter(value: unknown, ip = "local", previousGate?: string): AuthResult {
  limit(`character.requests:${ip}`, 20, 60);
  return withState((db) =>
    transaction(db, () => {
      if (previousGate)
        db.prepare("DELETE FROM operator_challenge WHERE hash=? AND purpose='character'").run(
          digest(previousGate),
        );
      const user = userFrom(db);
      active(user, ip);
      const blocked = db
        .prepare("SELECT count FROM operator_limit WHERE key=? AND expires>?")
        .get(digest(`character.failed:${ip}`), now());
      if (Number(blocked?.count ?? 0) >= 5) throw new Error("RATE_LIMITED");
      let matches = false;
      try {
        matches = equal(characterHash(value), user.character_hash);
      } catch {
        /* Invalid choices never reach a password verifier. */
      }
      if (!matches) {
        db.prepare(
          `INSERT INTO operator_limit(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN ? ELSE expires END`,
        ).run(digest(`character.failed:${ip}`), now() + 300, now(), now(), now() + 300);
        event(db, "character.failed", "operator", "rejected");
        return { phase: "password" as const, gate: "" };
      }
      const raw = token();
      db.prepare("INSERT INTO operator_challenge(hash,purpose,expires,metadata,ip) VALUES(?,?,?,?,?)").run(
        digest(raw),
        "character",
        now() + 300,
        JSON.stringify({ version: user.security_version }),
        ip,
      );
      event(db, "character.verified");
      return { phase: "password" as const, gate: raw };
    }),
  );
}
function bootstrapWithin(db: DatabaseSync, bootstrap: string | null, manual: boolean) {
  const user = userFrom(db);
  if (
    !db
      .prepare("DELETE FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>? RETURNING id")
      .get(bootstrap, now()) ||
    (manual ? user?.recovery_required !== 1 : Boolean(user))
  )
    throw new Error("INVALID_BOOTSTRAP");
}
function provision(
  db: DatabaseSync,
  password: string | null,
  factor: string,
  step: number,
  policy: Policy,
  bootstrap: string | null,
  manual: boolean,
) {
  bootstrapWithin(db, bootstrap, manual);
  if (manual)
    db.prepare(
      "UPDATE operator_user SET password=?,factor=?,last_step=?,username=?,character_hash=?,ip_allowlist=?,mfa_enabled=?,recovery_required=0,security_version=security_version+1 WHERE id=1",
    ).run(
      password,
      factor,
      step,
      policy.username,
      policy.characterHash,
      policy.ipAllowlist,
      Number(policy.mfaEnabled),
    );
  else
    db.prepare(
      "INSERT INTO operator_user(id,email,password,factor,last_step,username,character_hash,ip_allowlist,mfa_enabled) VALUES(1,?,?,?,?,?,?,?,?)",
    ).run(
      process.env.OPERATOR_EMAIL ?? "",
      password,
      factor,
      step,
      policy.username,
      policy.characterHash,
      policy.ipAllowlist,
      Number(policy.mfaEnabled),
    );
  revokeWithin(db);
  db.prepare("DELETE FROM operator_recovery").run();
}
async function qrResult(raw: string, secret: string): Promise<AuthResult> {
  const uri = generateURI({ issuer: "OpenHubPanel", label: process.env.OPERATOR_EMAIL ?? "owner", secret });
  return { challenge: raw, secret, qr: await toDataURL(uri, { width: 240, margin: 2 }), phase: "enroll" };
}
async function enrollment(
  purpose: "setup" | "manual" | "recovery",
  password: string | null,
  bootstrap: string | null,
  policy: Policy,
  ip: string,
) {
  const raw = token(),
    secret = generateSecret();
  withState((db) =>
    transaction(db, () => {
      const user = userFrom(db);
      if (purpose === "setup" || purpose === "manual") {
        if (
          !db
            .prepare("SELECT hash FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>?")
            .get(bootstrap, now()) ||
          (purpose === "setup" ? Boolean(user) : user?.recovery_required !== 1)
        )
          throw new Error("INVALID_BOOTSTRAP");
      } else active(user, ip);
      if (purpose !== "setup")
        db.prepare("DELETE FROM operator_challenge WHERE purpose IN ('recovery','manual','enable')").run();
      db.prepare(
        "INSERT INTO operator_challenge(hash,purpose,expires,password,factor,bootstrap,metadata,ip) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        digest(raw),
        purpose,
        now() + 300,
        password,
        seal(secret, "totp"),
        bootstrap,
        JSON.stringify({ policy, version: user?.security_version }),
        ip,
      );
      event(db, `${purpose}.started`);
    }),
  );
  return qrResult(raw, secret);
}
export async function beginSetup(
  bootstrap: unknown,
  password: unknown,
  manual = false,
  options: Record<string, unknown> = {},
  ip = "local",
): Promise<AuthResult> {
  limit("setup", 10, 900);
  if (typeof bootstrap !== "string" || bootstrap.length > 256 || (!manual && configured()))
    throw new Error("INVALID_BOOTSTRAP");
  withState((db) => {
    if (
      !db
        .prepare("SELECT hash FROM operator_bootstrap WHERE id=1 AND hash=? AND expires>?")
        .get(digest(bootstrap), now())
    )
      throw new Error("INVALID_BOOTSTRAP");
  });
  const policy = newPolicy(options),
    passwordHash = await safePassword(password);
  if (policy.mfaEnabled)
    return enrollment(manual ? "manual" : "setup", passwordHash, digest(bootstrap), policy, ip);
  return withState((db) =>
    transaction(db, () => {
      provision(db, passwordHash, "", -1, policy, digest(bootstrap), manual);
      event(db, manual ? "manual.completed" : "setup.completed");
      return { phase: "complete", session: issueSession(db, ip), recoveryCodes: [] };
    }),
  );
}
export async function beginLogin(
  name: unknown,
  password: unknown,
  gateRaw?: string,
  ip = "local",
): Promise<AuthResult> {
  // Gate validation precedes password rate counters and Argon2 verification.
  const snapshot = withState((db) =>
    transaction(db, () => {
      const user = userFrom(db);
      active(user, ip);
      const gate = db
        .prepare(
          "SELECT * FROM operator_challenge WHERE hash=? AND purpose='character' AND expires>? AND attempts<5 AND ip=?",
        )
        .get(digest(gateRaw ?? ""), now(), ip) as Challenge | undefined;
      if (!gate || JSON.parse(gate.metadata).version !== user.security_version)
        throw new Error("CHARACTER_REQUIRED");
      db.prepare("UPDATE operator_challenge SET attempts=attempts+1 WHERE hash=?").run(gate.hash);
      return { user, gate };
    }),
  );
  limit("password.account", 10, 900);
  const nameMatches =
    typeof name === "string" &&
    [normalizedUsername(snapshot.user.email), normalizedUsername(snapshot.user.username)].includes(
      normalizedUsername(name.trim()),
    );
  if (!nameMatches || !(await validPassword(snapshot.user, password))) {
    failure("password.failed");
    throw new Error("INVALID_CREDENTIALS");
  }
  return withState((db) =>
    transaction(db, () => {
      const user = userFrom(db);
      active(user, ip);
      if (
        user.security_version !== snapshot.user.security_version ||
        user.password !== snapshot.user.password ||
        !db
          .prepare("DELETE FROM operator_challenge WHERE hash=? AND expires>? AND ip=? RETURNING hash")
          .get(snapshot.gate.hash, now(), ip)
      )
        throw new Error("CHARACTER_REQUIRED");
      if (!user.mfa_enabled) {
        event(db, "login.completed");
        return { phase: "complete", session: issueSession(db, ip), recoveryCodes: [] };
      }
      const raw = token();
      db.prepare("INSERT INTO operator_challenge(hash,purpose,expires,metadata,ip) VALUES(?,?,?,?,?)").run(
        digest(raw),
        "login",
        now() + 300,
        JSON.stringify({ version: user.security_version }),
        ip,
      );
      event(db, "password.verified");
      return { challenge: raw, phase: "verify" };
    }),
  );
}
export async function totpStep(secret: string, code: unknown) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) throw new Error("INVALID_CODE");
  const result = await verify({ secret, token: code, epochTolerance: 30 });
  if (!result.valid || !("timeStep" in result)) throw new Error("INVALID_CODE");
  return Number(result.timeStep);
}
export async function finishChallenge(raw: string | undefined, code: unknown, ip = "local") {
  limit("factor.account", 15, 900);
  const snapshot = withState((db) =>
    transaction(db, () => {
      const challenge = db
        .prepare(
          "UPDATE operator_challenge SET attempts=attempts+1 WHERE hash=? AND expires>? AND attempts<5 AND ip=? AND purpose IN ('login','setup','manual','recovery','enable') RETURNING *",
        )
        .get(digest(raw ?? ""), now(), ip) as Challenge | undefined;
      if (!challenge) throw new Error("CHALLENGE_EXPIRED");
      const user = userFrom(db);
      if (["login", "recovery", "enable"].includes(challenge.purpose)) active(user, ip);
      return { challenge, user };
    }),
  );
  const { challenge } = snapshot;
  const factor = challenge.factor ?? snapshot.user?.factor;
  if (!factor) throw new Error("INVALID_CODE");
  let step: number;
  try {
    step = await totpStep(unseal(factor, "totp"), code);
  } catch {
    failure("factor.failed");
    throw new Error("INVALID_CODE");
  }
  const codes = challenge.purpose === "login" ? [] : Array.from({ length: 8 }, token);
  return withState((db) =>
    transaction(db, () => {
      if (
        !db
          .prepare("SELECT hash FROM operator_challenge WHERE hash=? AND expires>? AND ip=?")
          .get(challenge.hash, now(), ip)
      )
        throw new Error("CHALLENGE_EXPIRED");
      const metadata = JSON.parse(challenge.metadata) as {
        policy: Policy;
        version?: number;
        sessionHash?: string;
      };
      if (challenge.purpose === "setup" || challenge.purpose === "manual") {
        provision(
          db,
          challenge.password,
          factor,
          step,
          metadata.policy,
          challenge.bootstrap,
          challenge.purpose === "manual",
        );
      } else {
        const user = userFrom(db);
        active(user, ip);
        if (metadata.version !== user.security_version) throw new Error("CHALLENGE_EXPIRED");
        if (challenge.purpose === "login") {
          if (
            !user.mfa_enabled ||
            factor !== user.factor ||
            !db
              .prepare("UPDATE operator_user SET last_step=? WHERE id=1 AND last_step<? RETURNING id")
              .get(step, step)
          )
            throw new Error("CODE_ALREADY_USED");
        } else {
          if (challenge.purpose === "enable") {
            sessionWithin(db, metadata.sessionHash ?? "");
            if (!allowsIp(metadata.policy.ipAllowlist, ip)) throw new Error("IP_WOULD_LOCK_OUT");
            db.prepare("UPDATE operator_user SET username=?,character_hash=?,ip_allowlist=? WHERE id=1").run(
              metadata.policy.username,
              metadata.policy.characterHash,
              metadata.policy.ipAllowlist,
            );
          }
          db.prepare(
            "UPDATE operator_user SET factor=?,last_step=?,mfa_enabled=1,security_version=security_version+1 WHERE id=1",
          ).run(factor, step);
          revokeWithin(db);
        }
      }
      db.prepare("DELETE FROM operator_challenge WHERE hash=?").run(challenge.hash);
      if (codes.length) {
        db.prepare("DELETE FROM operator_recovery").run();
        for (const value of codes)
          db.prepare("INSERT INTO operator_recovery(hash) VALUES(?)").run(digest(value));
        db.prepare("DELETE FROM operator_challenge").run();
      }
      event(db, `${challenge.purpose}.completed`);
      return { session: issueSession(db, ip), recoveryCodes: codes };
    }),
  );
}
export async function beginRecovery(raw: string | undefined, code: unknown, ip = "local") {
  limit("recovery.account", 5, 900);
  if (typeof code !== "string" || code.length > 256) throw new Error("INVALID_CODE");
  const policy = withState((db) =>
    transaction(db, () => {
      const user = userFrom(db);
      active(user, ip);
      const challenge = db
        .prepare(
          "SELECT metadata FROM operator_challenge WHERE hash=? AND purpose='login' AND expires>? AND attempts<5 AND ip=?",
        )
        .get(digest(raw ?? ""), now(), ip);
      if (
        !user.mfa_enabled ||
        !challenge ||
        JSON.parse(String(challenge.metadata)).version !== user.security_version ||
        !db.prepare("DELETE FROM operator_recovery WHERE hash=? RETURNING hash").get(digest(code))
      )
        throw new Error("INVALID_CODE");
      revokeWithin(db);
      event(db, "recovery.consumed");
      return userPolicy(user);
    }),
  );
  return enrollment("recovery", null, null, policy, ip);
}
export async function prepareStepUp(
  raw: string | undefined,
  input: Record<string, unknown>,
  ip = "local",
  passwordRequired = false,
): Promise<StepUp> {
  const session = requireSession(raw, ip);
  limit("stepup.account", 15, 900);
  const user = withState((db) => userFrom(db));
  active(user, ip);
  if ((passwordRequired || !user.mfa_enabled) && !(await validPassword(user, input.currentPassword)))
    throw new Error("INVALID_CREDENTIALS");
  return {
    sessionHash: session.hash,
    passwordHash: user.password,
    factor: user.factor,
    version: user.security_version,
    step: user.mfa_enabled ? await totpStep(unseal(user.factor, "totp"), input.code) : null,
    ip,
  };
}
export function commitStepUp(db: DatabaseSync, proof: StepUp) {
  sessionWithin(db, proof.sessionHash);
  const user = userFrom(db);
  active(user, proof.ip);
  if (
    user.security_version !== proof.version ||
    user.password !== proof.passwordHash ||
    user.factor !== proof.factor
  )
    throw new Error("UNAUTHENTICATED");
  if (
    user.mfa_enabled &&
    (proof.step === null ||
      !db
        .prepare("UPDATE operator_user SET last_step=? WHERE id=1 AND last_step<? RETURNING id")
        .get(proof.step, proof.step))
  )
    throw new Error("CODE_ALREADY_USED");
  return { ...user, last_step: proof.step ?? user.last_step };
}
export function revoke(raw: string | undefined, all: boolean, ip = "local") {
  const session = requireSession(raw, ip);
  withState((db) =>
    transaction(db, () => {
      if (all) revokeWithin(db);
      else db.prepare("UPDATE operator_session SET revoked=1 WHERE hash=?").run(session.hash);
      event(db, all ? "sessions.revoked" : "session.logout");
    }),
  );
}
export async function changePassword(
  raw: string | undefined,
  currentPassword: unknown,
  password: unknown,
  code: unknown,
  ip = "local",
) {
  const proof = await prepareStepUp(raw, { currentPassword, code }, ip, true);
  const nextPassword = await safePassword(password);
  withState((db) =>
    transaction(db, () => {
      commitStepUp(db, proof);
      db.prepare("UPDATE operator_user SET password=?,security_version=security_version+1 WHERE id=1").run(
        nextPassword,
      );
      revokeWithin(db);
      event(db, "password.changed");
    }),
  );
}
export function securityProfile(raw: string | undefined, ip = "local") {
  requireSession(raw, ip);
  return withState((db) => {
    const user = userFrom(db);
    active(user, ip);
    return {
      username: user.username || user.email,
      character: selectedCharacter(user.character_hash),
      mfaEnabled: Boolean(user.mfa_enabled),
      ipEnabled: JSON.parse(user.ip_allowlist).length > 0,
      ipRules: JSON.parse(user.ip_allowlist).join("\n"),
      currentIp: ip,
    };
  });
}
export async function updateSecurity(
  raw: string | undefined,
  input: Record<string, unknown>,
  ip = "local",
): Promise<AuthResult> {
  const proof = await prepareStepUp(raw, input, ip, true);
  const rules = input.ipEnabled === true ? parseAllowlist(input.ipRules) : [];
  if (input.ipEnabled === true && !rules.length) throw new Error("INVALID_IP_RULES");
  const policy: Policy = {
    username: username(input.username),
    characterHash: characterHash(input.character),
    ipAllowlist: JSON.stringify(rules),
    mfaEnabled: input.mfaEnabled === true,
  };
  if (!allowsIp(policy.ipAllowlist, ip)) throw new Error("IP_WOULD_LOCK_OUT");
  const secret = generateSecret(),
    rawChallenge = token();
  const enroll = withState((db) =>
    transaction(db, () => {
      const user = commitStepUp(db, proof);
      if (!user.mfa_enabled && policy.mfaEnabled) {
        db.prepare("DELETE FROM operator_challenge WHERE purpose='enable'").run();
        db.prepare(
          "INSERT INTO operator_challenge(hash,purpose,expires,factor,metadata,ip) VALUES(?,?,?,?,?,?)",
        ).run(
          digest(rawChallenge),
          "enable",
          now() + 300,
          seal(secret, "totp"),
          JSON.stringify({ policy, version: user.security_version, sessionHash: proof.sessionHash }),
          ip,
        );
        event(db, "mfa-enrollment.started");
        return true;
      }
      db.prepare(
        "UPDATE operator_user SET username=?,character_hash=?,ip_allowlist=?,mfa_enabled=?,factor=?,last_step=?,security_version=security_version+1 WHERE id=1",
      ).run(
        policy.username,
        policy.characterHash,
        policy.ipAllowlist,
        Number(policy.mfaEnabled),
        policy.mfaEnabled ? user.factor : "",
        policy.mfaEnabled ? user.last_step : -1,
      );
      if (!policy.mfaEnabled) db.prepare("DELETE FROM operator_recovery").run();
      revokeWithin(db);
      event(db, "security.updated");
      return false;
    }),
  );
  return enroll ? qrResult(rawChallenge, secret) : { phase: "complete" };
}
