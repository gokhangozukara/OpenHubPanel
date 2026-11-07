import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generate, generateSecret } from "otplib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveSettings } from "./connector";
import { digest, migrate, now, seal, state } from "./store";

let directory: string;
let secret: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-intent-"));
  vi.stubEnv("OPENHUB_OPERATOR", "1");
  vi.stubEnv("OPERATOR_STATE_FILE", path.join(directory, "identity.sqlite"));
  vi.stubEnv("OPERATOR_KEY", "71".repeat(32));
  vi.stubEnv("OPERATOR_CONNECTOR_TOKEN", "test-token-".repeat(5));
  vi.stubEnv("PILOT_UPSTREAM_ORIGIN", "http://127.0.0.1:3046");
  secret = generateSecret();
  const db = state();
  migrate(db);
  db.prepare("INSERT INTO operator_user(id,email,password,factor) VALUES(1,?,?,?)").run(
    "fixture@example.invalid",
    "unused",
    seal(secret, "totp"),
  );
  db.prepare("INSERT INTO operator_session(hash,created,seen) VALUES(?,?,?)").run(
    digest("fixture-session"),
    now(),
    now(),
  );
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
async function input() {
  return {
    requestId: randomUUID(),
    revision: "c".repeat(64),
    values: { notes: "synthetic" },
    code: await generate({ secret }),
  };
}
it("requires a full active session, consumes a factor once, and scopes idempotency to the exact payload", async () => {
  const fetcher = vi.fn(async () => Response.json({ ok: true, revision: "a".repeat(64) }));
  vi.stubGlobal("fetch", fetcher);
  const value = await input();
  await expect(saveSettings(undefined, "example", "notes", value)).rejects.toThrow("UNAUTHENTICATED");
  const result = await saveSettings("fixture-session", "example", "notes", value);
  expect(result.ok).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await saveSettings("fixture-session", "example", "notes", value)).toEqual(result);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(
    saveSettings("fixture-session", "example", "notes", { ...value, values: { notes: "changed" } }),
  ).rejects.toThrow("CONFLICT");
  await expect(
    saveSettings("fixture-session", "example", "notes", { ...value, requestId: randomUUID() }),
  ).rejects.toThrow("CODE_ALREADY_USED");
  const db = state();
  try {
    db.prepare("UPDATE operator_session SET revoked=1").run();
  } finally {
    db.close();
  }
  await expect(saveSettings("fixture-session", "example", "notes", value)).rejects.toThrow("UNAUTHENTICATED");
});
it("persists unknown effects and reconciles by request ID without resending a write", async () => {
  const fetcher = vi.fn(async () => {
    throw new Error("synthetic timeout");
  });
  vi.stubGlobal("fetch", fetcher);
  const value = await input();
  await expect(saveSettings("fixture-session", "example", "notes", value)).rejects.toThrow("UNKNOWN_OUTCOME");
  const db = state();
  try {
    expect(db.prepare("SELECT status FROM operator_intent").get()?.status).toBe("pending");
  } finally {
    db.close();
  }
  const reconcile = vi.fn(async () => Response.json({ ok: true, revision: "a".repeat(64) }));
  vi.stubGlobal("fetch", reconcile);
  expect((await saveSettings("fixture-session", "example", "notes", value)).ok).toBe(true);
  expect(reconcile.mock.calls[0]?.length).toBe(2);
  const called = reconcile.mock.calls[0] as unknown as [URL, RequestInit];
  expect(called[0].pathname).toBe(`/internal/openhub/operations/${value.requestId}`);
  expect(called[1].method).toBe("GET");
});
it("records conflicts without success and does not perform remote work if local audit fails", async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  const value = await input();
  await expect(saveSettings("fixture-session", "example", "notes", value)).rejects.toThrow("CONFLICT");
  await expect(saveSettings("fixture-session", "example", "notes", value)).rejects.toThrow("CONFLICT");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const db = state();
  try {
    db.prepare("UPDATE operator_user SET last_step=-1").run();
    db.exec(
      "CREATE TRIGGER reject_intent_audit BEFORE INSERT ON operator_event BEGIN SELECT RAISE(ABORT,'TEST_AUDIT_FAILURE'); END",
    );
  } finally {
    db.close();
  }
  await expect(
    saveSettings("fixture-session", "example", "notes", { ...value, requestId: randomUUID() }),
  ).rejects.toThrow("TEST_AUDIT_FAILURE");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
