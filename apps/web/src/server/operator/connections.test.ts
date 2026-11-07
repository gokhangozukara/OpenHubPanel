import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generate, generateSecret } from "otplib";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  addConnection,
  changeConnection,
  listConnections,
  readConnection,
  updateArticle,
} from "./connections";
import { approvedUrl, publicAddress, remoteJson } from "./remote-http";
import { digest, migrate, now, seal, state, unseal } from "./store";

vi.mock("./remote-http", async (importActual) => ({
  ...(await importActual<typeof import("./remote-http")>()),
  remoteJson: vi.fn(),
}));
let directory: string;
let factor: string;
let epoch: number;
const manifest = {
  id: "example-content",
  name: "Example",
  contractVersion: "1.0",
  resources: [{ id: "articles", name: "Articles", capabilities: ["list", "read", "update"] }],
};
const transport = vi.mocked(remoteJson);
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-connections-"));
  vi.stubEnv("OPENHUB_OPERATOR", "1");
  vi.stubEnv("OPERATOR_STATE_FILE", path.join(directory, "identity.sqlite"));
  vi.stubEnv("OPERATOR_KEY", "91".repeat(32));
  epoch = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => epoch);
  factor = generateSecret();
  const db = state();
  migrate(db);
  db.prepare("INSERT INTO operator_user(id,email,password,factor) VALUES(1,?,?,?)").run(
    "fixture@example.invalid",
    "unused",
    seal(factor, "totp"),
  );
  db.prepare("INSERT INTO operator_session(hash,created,seen) VALUES(?,?,?)").run(
    digest("fixture-session"),
    now(),
    now(),
  );
  db.close();
  transport.mockReset();
  transport.mockImplementation(async (_base, endpoint) =>
    endpoint === "/health"
      ? { status: "ok", contractVersion: "1.0" }
      : endpoint === "/manifest"
        ? manifest
        : endpoint === "/articles"
          ? { items: [{ id: "first", title: "Original title", status: "published", version: 1 }] }
          : {},
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (!path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
    throw new Error("Unexpected fixture path");
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 });
});
async function proof() {
  epoch += 30000;
  return { code: await generate({ secret: factor, epoch: now() }) };
}
async function create() {
  return addConnection(
    "fixture-session",
    {
      name: "Content",
      url: "https://api.example.com/hubpanel/v1",
      kind: "api",
      credential: "synthetic-connection-credential-98765",
      approveTarget: true,
      ...(await proof()),
    },
    "local",
  );
}
it("accepts only HTTPS API targets and globally routable addresses", () => {
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:8443/api",
    "https://example.com/api?next=x",
    "https://example.com/%2e%2e/private",
  ])
    expect(() => approvedUrl(url)).toThrow();
  expect(approvedUrl("https://api.example.com/hubpanel/v1/").pathname).toBe("/hubpanel/v1");
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "224.0.0.1",
  ])
    expect(publicAddress(address), address).toBe(false);
  expect(publicAddress("1.1.1.1")).toBe(true);
  expect(publicAddress("2606:4700:4700::1111")).toBe(true);
});
it("starts connections read-only, encrypts credentials and denies unauthenticated registration", async () => {
  await expect(addConnection(undefined, { name: "Content" }, "local")).rejects.toThrow("UNAUTHENTICATED");
  const { id } = await create();
  const listed = listConnections("fixture-session", "local");
  expect(listed[0]?.write_enabled).toBe(0);
  expect(JSON.stringify(listed)).not.toContain("synthetic-connection-credential");
  const db = state();
  const row = db.prepare("SELECT secret FROM operator_connection WHERE id=?").get(id);
  db.close();
  expect(row?.secret).not.toContain("synthetic");
  expect(unseal(String(row?.secret), `connection:${id}`)).toContain("synthetic-connection-credential");
  expect((await readConnection("fixture-session", id, "local")).items[0]?.title).toBe("Original title");
  await expect(updateArticle("fixture-session", id, "first", { title: "Changed" }, "local")).rejects.toThrow(
    "REMOTE_READ_ONLY",
  );
});
it("requires separate write approval, changes a title once and rejects changed replays", async () => {
  const { id } = await create();
  let row = listConnections("fixture-session", "local")[0];
  await changeConnection(
    "fixture-session",
    id,
    { action: "enable-writes", revision: row?.revision, ...(await proof()) },
    "local",
  );
  row = listConnections("fixture-session", "local")[0];
  const requestId = randomUUID();
  const input = {
    title: "Changed title",
    expectedVersion: 1,
    requestId,
    connectionRevision: row?.revision,
    ...(await proof()),
  };
  transport.mockImplementation(async (_base, endpoint, _secret, method) =>
    method === "PATCH"
      ? { ok: true, idempotencyKey: requestId, version: 2 }
      : endpoint === "/manifest"
        ? manifest
        : { items: [] },
  );
  expect((await updateArticle("fixture-session", id, "first", input, "local")).version).toBe(2);
  expect((await updateArticle("fixture-session", id, "first", input, "local")).version).toBe(2);
  expect(transport.mock.calls.filter((call) => call[3] === "PATCH")).toHaveLength(1);
  await expect(
    updateArticle("fixture-session", id, "first", { ...input, title: "Different" }, "local"),
  ).rejects.toThrow("CONFLICT");
});
it("reconciles uncertain writes without resending and immediately blocks disabled connections", async () => {
  const { id } = await create();
  let row = listConnections("fixture-session", "local")[0];
  await changeConnection(
    "fixture-session",
    id,
    { action: "enable-writes", revision: row?.revision, ...(await proof()) },
    "local",
  );
  row = listConnections("fixture-session", "local")[0];
  const requestId = randomUUID();
  const input = {
    title: "Changed",
    expectedVersion: 1,
    requestId,
    connectionRevision: row?.revision,
    ...(await proof()),
  };
  transport.mockRejectedValue(new Error("timeout"));
  await expect(updateArticle("fixture-session", id, "first", input, "local")).rejects.toThrow(
    "UNKNOWN_OUTCOME",
  );
  transport.mockResolvedValue({ ok: true, idempotencyKey: requestId, version: 2 });
  expect((await updateArticle("fixture-session", id, "first", input, "local")).version).toBe(2);
  expect(transport.mock.calls.filter((call) => call[3] === "PATCH")).toHaveLength(1);
  expect(transport.mock.calls.some((call) => call[1] === `/operations/${requestId}`)).toBe(true);
  await changeConnection(
    "fixture-session",
    id,
    { action: "disable", revision: row?.revision, ...(await proof()) },
    "local",
  );
  const count = transport.mock.calls.length;
  await expect(readConnection("fixture-session", id, "local")).rejects.toThrow("CONNECTION_NOT_FOUND");
  expect(transport).toHaveBeenCalledTimes(count);
});
it("does not register a connection if the atomic audit fails; shortcuts need no credentials or server fetch", async () => {
  const db = state();
  db.exec(
    "CREATE TRIGGER reject_connection_audit BEFORE INSERT ON operator_event BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END",
  );
  db.close();
  await expect(create()).rejects.toThrow("fixture audit failure");
  expect(listConnections("fixture-session", "local")).toHaveLength(0);
  const writer = state();
  writer.exec("DROP TRIGGER reject_connection_audit");
  writer.close();
  transport.mockClear();
  const result = await addConnection(
    "fixture-session",
    { name: "Other panel", kind: "link", url: "https://panel.example.com/manage", ...(await proof()) },
    "local",
  );
  expect(result.id).toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
});
