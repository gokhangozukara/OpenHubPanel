import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generate } from "otplib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  beginLogin,
  beginRecovery,
  beginSetup,
  changePassword,
  configured,
  finishChallenge,
  requireSession,
  revoke,
} from "./auth";
import { digest, migrate, now, seal, state, token, unseal } from "./store";

let directory: string;
let bootstrap: string;
let epoch: number;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-operator-"));
  vi.stubEnv("OPENHUB_OPERATOR", "1");
  vi.stubEnv("OPERATOR_STATE_FILE", path.join(directory, "identity.sqlite"));
  vi.stubEnv("OPERATOR_KEY", "73".repeat(32));
  vi.stubEnv("OPERATOR_EMAIL", "owner@example.invalid");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("ABCDE:0\r\n")),
  );
  bootstrap = token();
  epoch = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => epoch);
  const db = state();
  migrate(db);
  db.prepare("INSERT INTO operator_bootstrap VALUES(1,?,?)").run(digest(bootstrap), now() + 900);
  db.close();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (!path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
    throw new Error("Unexpected fixture path");
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 });
});
const password = "Synthetic owner password for automated testing 59273";
async function setup() {
  const enrollment = await beginSetup(bootstrap, password);
  const code = await generate({ secret: enrollment.secret, epoch: now() });
  const result = await finishChallenge(enrollment.challenge, code);
  return { ...result, ...enrollment };
}

it("keeps password-only authority separate, consumes bootstrap once and stores only hashed sessions/recovery", async () => {
  const enrollment = await beginSetup(bootstrap, password);
  expect(configured()).toBe(false);
  expect(() => requireSession(enrollment.challenge)).toThrow("UNAUTHENTICATED");
  await expect(finishChallenge(enrollment.challenge, "incorrect")).rejects.toThrow("INVALID_CODE");
  const code = await generate({ secret: enrollment.secret, epoch: now() });
  const results = await Promise.allSettled([
    finishChallenge(enrollment.challenge, code),
    finishChallenge(enrollment.challenge, code),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const winner = results.find((result) => result.status === "fulfilled");
  if (winner?.status !== "fulfilled") throw new Error("No enrollment completed");
  expect(requireSession(winner.value.session).email).toBe("owner@example.invalid");
  expect(winner.value.recoveryCodes).toHaveLength(8);
  const db = state();
  try {
    expect(db.prepare("SELECT * FROM operator_bootstrap").all()).toHaveLength(0);
    const user = db.prepare("SELECT * FROM operator_user").get();
    expect(user?.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(user?.factor).not.toContain(enrollment.secret);
    expect(JSON.stringify(db.prepare("SELECT * FROM operator_session").all())).not.toContain(
      winner.value.session,
    );
    for (const value of winner.value.recoveryCodes)
      expect(JSON.stringify(db.prepare("SELECT * FROM operator_recovery").all())).not.toContain(value);
  } finally {
    db.close();
  }
  await expect(beginSetup(bootstrap, password)).rejects.toThrow("INVALID_BOOTSTRAP");
  await expect(finishChallenge(enrollment.challenge, code)).rejects.toThrow("CHALLENGE_EXPIRED");
});

it("rejects TOTP replay across distinct login challenges and immediately enforces logout and expiry", async () => {
  const owner = await setup();
  const one = await beginLogin("owner@example.invalid", password);
  const two = await beginLogin("owner@example.invalid", password);
  expect(() => requireSession(one.challenge)).toThrow("UNAUTHENTICATED");
  const previous = await generate({ secret: owner.secret, epoch: now() });
  await expect(finishChallenge(one.challenge, previous)).rejects.toThrow("CODE_ALREADY_USED");
  epoch += 31000;
  const code = await generate({ secret: owner.secret, epoch: now() });
  const results = await Promise.allSettled([
    finishChallenge(one.challenge, code),
    finishChallenge(two.challenge, code),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  revoke(owner.session, true);
  expect(() => requireSession(owner.session)).toThrow("UNAUTHENTICATED");
  const winner = results.find((result) => result.status === "fulfilled");
  if (winner?.status !== "fulfilled") throw new Error("No login completed");
  expect(() => requireSession(winner.value.session)).toThrow("UNAUTHENTICATED");
  const db = state();
  try {
    db.prepare("INSERT INTO operator_session VALUES(?,?,?,0)").run(
      digest("expired-test"),
      now() - 8 * 3600,
      now(),
    );
    db.prepare("INSERT INTO operator_session VALUES(?,?,?,0)").run(
      digest("idle-test"),
      now() - 1000,
      now() - 901,
    );
  } finally {
    db.close();
  }
  expect(() => requireSession("expired-test")).toThrow("UNAUTHENTICATED");
  expect(() => requireSession("idle-test")).toThrow("UNAUTHENTICATED");
});

it("consumes recovery once, grants enrollment only and revokes old sessions/factors after replacement", async () => {
  const owner = await setup();
  const login = await beginLogin("owner@example.invalid", password);
  const recoveryCode = owner.recoveryCodes[0];
  const enrollment = await beginRecovery(login.challenge, recoveryCode);
  expect(() => requireSession(enrollment.challenge)).toThrow("UNAUTHENTICATED");
  expect(() => requireSession(owner.session)).toThrow("UNAUTHENTICATED");
  await expect(beginRecovery(login.challenge, recoveryCode)).rejects.toThrow("INVALID_CODE");
  const result = await finishChallenge(
    enrollment.challenge,
    await generate({ secret: enrollment.secret, epoch: now() }),
  );
  expect(requireSession(result.session).email).toBe("owner@example.invalid");
  const nextLogin = await beginLogin("owner@example.invalid", password);
  epoch += 31000;
  await expect(
    finishChallenge(nextLogin.challenge, await generate({ secret: owner.secret, epoch: now() })),
  ).rejects.toThrow("INVALID_CODE");
  expect(result.recoveryCodes).not.toContain(recoveryCode);
});

it("limits factor attempts and preserves aggregate account limits across challenges", async () => {
  const owner = await setup();
  const login = await beginLogin("owner@example.invalid", password);
  for (let index = 0; index < 5; index++)
    await expect(finishChallenge(login.challenge, "bad-code")).rejects.toThrow("INVALID_CODE");
  epoch += 31000;
  await expect(
    finishChallenge(login.challenge, await generate({ secret: owner.secret, epoch: now() })),
  ).rejects.toThrow("CHALLENGE_EXPIRED");
  for (let index = 0; index < 9; index++)
    await expect(beginLogin("owner@example.invalid", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
  await expect(beginLogin("owner@example.invalid", password)).rejects.toThrow("RATE_LIMITED");
});

it("rejects expired bootstrap, compromised passwords and unavailable password checks", async () => {
  await expect(beginSetup("not-the-token", password)).rejects.toThrow("INVALID_BOOTSTRAP");
  await expect(beginSetup(bootstrap, "short")).rejects.toThrow("PASSWORD_LENGTH");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  await expect(beginSetup(bootstrap, password)).rejects.toThrow("PASSWORD_CHECK_UNAVAILABLE");
  epoch += 901000;
  await expect(beginSetup(bootstrap, password)).rejects.toThrow("INVALID_BOOTSTRAP");
});

it("binds encrypted factor material to its purpose and rolls back enrollment when auditing fails", async () => {
  const ciphertext = seal("synthetic-factor", "totp");
  expect(unseal(ciphertext, "totp")).toBe("synthetic-factor");
  expect(() => unseal(ciphertext, "different-purpose")).toThrow();
  const enrollment = await beginSetup(bootstrap, password);
  const db = state();
  db.exec(
    "CREATE TRIGGER reject_events BEFORE INSERT ON operator_event BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END",
  );
  db.close();
  await expect(
    finishChallenge(enrollment.challenge, await generate({ secret: enrollment.secret, epoch: now() })),
  ).rejects.toThrow();
  expect(configured()).toBe(false);
  const check = state();
  try {
    expect(check.prepare("SELECT * FROM operator_session").all()).toHaveLength(0);
    expect(check.prepare("SELECT * FROM operator_bootstrap").all()).toHaveLength(1);
  } finally {
    check.close();
  }
});

it("requires password and fresh factor to change a password and revokes every previous session/challenge", async () => {
  const owner = await setup();
  await expect(changePassword(owner.session, "wrong", `${password} changed`, "bad")).rejects.toThrow(
    "INVALID_CREDENTIALS",
  );
  epoch += 31000;
  await changePassword(
    owner.session,
    password,
    `${password} changed`,
    await generate({ secret: owner.secret, epoch: now() }),
  );
  expect(() => requireSession(owner.session)).toThrow("UNAUTHENTICATED");
  await expect(beginLogin("owner@example.invalid", password)).rejects.toThrow("INVALID_CREDENTIALS");
  expect((await beginLogin("owner@example.invalid", `${password} changed`)).phase).toBe("verify");
});

it("trusted-console recovery preserves the owner, blocks restored authority, and requires new password and factor enrollment", async () => {
  const owner = await setup();
  const args = [
    "--import",
    "tsx",
    "scripts/operator-bootstrap.ts",
    "--recover",
    "--reason=automated-fixture-identity-verification",
  ];
  const url = execFileSync(process.execPath, args, {
    env: { ...process.env, APP_ORIGIN: "https://example.invalid" },
    encoding: "utf8",
  }).trim();
  const manualToken = new URLSearchParams(url.split("#")[1]).get("bootstrap");
  expect(() => requireSession(owner.session)).toThrow("UNAUTHENTICATED");
  await expect(beginLogin("owner@example.invalid", password)).rejects.toThrow("INVALID_CREDENTIALS");
  const enrollment = await beginSetup(manualToken, `${password} replaced`, true);
  expect(() => requireSession(enrollment.challenge)).toThrow("UNAUTHENTICATED");
  const result = await finishChallenge(
    enrollment.challenge,
    await generate({ secret: enrollment.secret, epoch: now() }),
  );
  expect(requireSession(result.session).email).toBe("owner@example.invalid");
  const db = state();
  try {
    expect(db.prepare("SELECT * FROM operator_user").all()).toHaveLength(1);
    expect(db.prepare("SELECT recovery_required FROM operator_user").get()?.recovery_required).toBe(0);
  } finally {
    db.close();
  }
  await expect(beginSetup(manualToken, password, true)).rejects.toThrow("INVALID_BOOTSTRAP");
});

import { execFileSync } from "node:child_process";
