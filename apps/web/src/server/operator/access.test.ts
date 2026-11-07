import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generate } from "otplib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { allowsIp, clientIp, parseAllowlist } from "./access";
import {
  beginLogin,
  beginSetup,
  finishChallenge,
  requireSession,
  securityProfile,
  selectCharacter,
  updateSecurity,
} from "./auth";
import { digest, migrate, now, state, token } from "./store";

let directory: string, bootstrap: string;
const ip = "203.0.113.25",
  password = "Z9!k2Q";
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-access-"));
  vi.stubEnv("OPENHUB_OPERATOR", "1");
  vi.stubEnv("OPERATOR_STATE_FILE", path.join(directory, "identity.sqlite"));
  vi.stubEnv("OPERATOR_KEY", "79".repeat(32));
  vi.stubEnv("OPERATOR_EMAIL", "owner@example.invalid");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("ABCDE:0\n")),
  );
  bootstrap = token();
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
async function owner() {
  const result = await beginSetup(
    bootstrap,
    password,
    false,
    { username: "gokhan", character: "fox", mfaEnabled: false },
    ip,
  );
  if (!result.session) throw new Error("Expected direct owner session without optional MFA");
  return result.session;
}
async function login(name = "gokhan", address = ip) {
  return beginLogin(name, password, selectCharacter("fox", address).gate, address);
}

it("accepts six-character passwords and optional MFA while requiring the server character gate before password attempts", async () => {
  const session = await owner();
  expect(requireSession(session, ip).mfaEnabled).toBe(false);
  expect(selectCharacter("duck", ip).gate).toBe("");
  await expect(beginLogin("gokhan", password, undefined, ip)).rejects.toThrow("CHARACTER_REQUIRED");
  const db = state();
  try {
    expect(
      db.prepare("SELECT * FROM operator_limit WHERE key=?").get(digest("password.account")),
    ).toBeUndefined();
  } finally {
    db.close();
  }
  const result = await login("GOKHAN");
  expect(result.phase).toBe("complete");
  expect(result.challenge).toBeUndefined();
  expect(requireSession(result.session, ip).username).toBe("gokhan");
  await expect(
    beginLogin("gokhan", password, selectCharacter("fox", ip).gate, "203.0.113.26"),
  ).rejects.toThrow("CHARACTER_REQUIRED");
});
it("expires character permission, limits wrong choices and invalidates the previous gate after a wrong selection", async () => {
  await owner();
  const gate = selectCharacter("fox", ip).gate;
  selectCharacter("duck", ip, gate);
  await expect(beginLogin("gokhan", password, gate, ip)).rejects.toThrow("CHARACTER_REQUIRED");
  const current = selectCharacter("fox", ip).gate;
  const db = state();
  try {
    db.prepare("UPDATE operator_challenge SET expires=? WHERE hash=?").run(now() - 1, digest(current ?? ""));
  } finally {
    db.close();
  }
  await expect(beginLogin("gokhan", password, current, ip)).rejects.toThrow("CHARACTER_REQUIRED");
  for (let index = 0; index < 4; index++) selectCharacter("owl", ip);
  expect(() => selectCharacter("fox", ip)).toThrow("RATE_LIMITED");
});
it("checks IP restrictions on sign-in and every session request and rejects self-lockout without changing settings", async () => {
  const session = await owner();
  const settings = {
    username: "gokhan",
    character: "fox",
    mfaEnabled: false,
    ipEnabled: true,
    ipRules: "203.0.113.0/24\n2001:db8::/32",
    currentPassword: password,
  };
  await expect(updateSecurity(session, { ...settings, ipRules: "198.51.100.2" }, ip)).rejects.toThrow(
    "IP_WOULD_LOCK_OUT",
  );
  expect(securityProfile(session, ip).ipEnabled).toBe(false);
  await updateSecurity(session, settings, ip);
  expect(() => requireSession(session, ip)).toThrow("UNAUTHENTICATED");
  expect(() => selectCharacter("fox", "198.51.100.2")).toThrow("IP_NOT_ALLOWED");
  const result = await login();
  expect(requireSession(result.session, ip).username).toBe("gokhan");
  expect(() => requireSession(result.session, "198.51.100.2")).toThrow("IP_NOT_ALLOWED");
  expect(() => requireSession(result.session)).toThrow("IP_NOT_ALLOWED");
  const ipv6 = await login("gokhan", "2001:db8::24");
  expect(requireSession(ipv6.session, "2001:db8::24").username).toBe("gokhan");
});
it("enables MFA only after verification, requests it on each login, and requires the current code to disable it", async () => {
  const session = await owner();
  const settings = {
    username: "gokhan",
    character: "fox",
    mfaEnabled: true,
    ipEnabled: false,
    ipRules: "",
    currentPassword: password,
  };
  const enrollment = await updateSecurity(session, settings, ip);
  expect(securityProfile(session, ip).mfaEnabled).toBe(false);
  if (!enrollment.secret) throw new Error("Expected factor enrollment");
  const activated = await finishChallenge(
    enrollment.challenge,
    await generate({ secret: enrollment.secret }),
    ip,
  );
  expect(requireSession(activated.session, ip).mfaEnabled).toBe(true);
  expect(activated.recoveryCodes).toHaveLength(8);
  expect((await login()).phase).toBe("verify");
  expect((await login()).phase).toBe("verify");
  await expect(
    updateSecurity(activated.session, { ...settings, mfaEnabled: false, code: "bad" }, ip),
  ).rejects.toThrow("INVALID_CODE");
  const db = state();
  try {
    db.prepare("UPDATE operator_user SET last_step=-1").run();
  } finally {
    db.close();
  }
  await updateSecurity(
    activated.session,
    { ...settings, mfaEnabled: false, code: await generate({ secret: enrollment.secret }) },
    ip,
  );
  expect((await login()).phase).toBe("complete");
});
it("supports IPv4/IPv6 CIDR and mapped client addresses, and rejects malformed IP policies", () => {
  expect(parseAllowlist("203.0.113.25\n2001:db8::/32")).toEqual(["203.0.113.25", "2001:db8::/32"]);
  expect(allowsIp('["203.0.113.0/24"]', "::ffff:203.0.113.25")).toBe(true);
  expect(allowsIp('["2001:db8::/32"]', "2001:db8:1234::9")).toBe(true);
  expect(allowsIp('["2001:db8::/32"]', "2001:db9::1")).toBe(false);
  expect(
    clientIp(
      new Headers({ "x-openhub-client-ip": "::ffff:203.0.113.25", "x-forwarded-for": "198.51.100.9" }),
    ),
  ).toBe("203.0.113.25");
  expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.25" }))).toBe("unknown");
  for (const invalid of ["bad", "203.0.113.1/33", "2001:db8::/129", "https://example.invalid"])
    expect(() => parseAllowlist(invalid)).toThrow("INVALID_IP_RULES");
});
