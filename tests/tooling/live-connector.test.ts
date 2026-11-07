import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const express = require("express");
const sqlite3 = require("sqlite3");
const createConnector = require("../../infra/connectors/hubstag.cjs");
const { safeNext } = require("../../infra/connectors/legacy-login.cjs");
const sections = createConnector.sections as Record<string, [string, string, string][]>;
let directory: string;
let database: DatabaseSync;
let server: Server;
let base: string;
let key: string;
it("keeps legacy editor sign-in destinations local and narrowly allowlisted", () => {
  expect(safeNext("/app/example?tab=push")).toBe("/app/example?tab=push");
  expect(safeNext("/app/example?tab=content")).toBe("/app/example?tab=content");
  expect(safeNext("/studio")).toBe("/studio");
  for (const target of [
    "//attacker.invalid",
    "https://attacker.invalid",
    "/app/../private",
    "/app/example?tab=push&next=//attacker.invalid",
    undefined,
  ])
    expect(safeNext(target)).toBe("/legacy");
});
beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "openhub-connector-"));
  const filename = path.join(directory, "source.sqlite");
  const keyFile = path.join(directory, "connector.key");
  key = randomBytes(32).toString("base64url");
  writeFileSync(keyFile, key);
  database = new DatabaseSync(filename);
  const fields = Object.values(sections)
    .flat()
    .map(
      ([name, , type]) =>
        `${name} ${type === "boolean" || type === "integer" ? "INTEGER DEFAULT 0" : "TEXT DEFAULT ''"}`,
    );
  database.exec(
    `CREATE TABLE apps(slug TEXT PRIMARY KEY); CREATE TABLE app_config(slug TEXT PRIMARY KEY, ${fields.join(",")},popup_version INTEGER DEFAULT 0,updated_at TEXT,fcm_service_account TEXT DEFAULT 'synthetic-private-path'); INSERT INTO apps VALUES('example'); INSERT INTO app_config(slug,popup_frequency) VALUES('example','once');`,
  );
  const app = express();
  app.use(express.json());
  const router = createConnector({
    express,
    sqlite3,
    databasePath: filename,
    keyFile,
    account: "test-owner",
  });
  app.use("/internal/openhub", router);
  await router.ready;
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/internal/openhub`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  database.close();
  if (!path.resolve(directory).startsWith(`${path.resolve(tmpdir())}${path.sep}`))
    throw new Error("Unexpected fixture path");
  rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 30 });
});
async function request(endpoint: string, method = "GET", payload?: unknown) {
  return fetch(`${base}${endpoint}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
async function configuration(section: string) {
  const response = await request(`/apps/example/settings/${section}`);
  expect(response.status).toBe(200);
  return response.json();
}
it("denies missing/forged service identity and never exposes credential fields", async () => {
  expect((await fetch(`${base}/apps/example/settings/notes`)).status).toBe(404);
  const result = await configuration("notes");
  expect(result.values).toEqual({ notes: "" });
  expect(JSON.stringify(result)).not.toContain("synthetic-private-path");
  expect((await request("/apps/missing/settings/notes")).status).toBe(404);
  expect((await request("/apps/example/settings/constructor")).status).toBe(404);
});
it("round-trips every section, records audit atomically and rejects stale writes and changed idempotency payloads", async () => {
  for (const [section, fields] of Object.entries(sections)) {
    const before = await configuration(section);
    const values = Object.fromEntries(
      fields.map(([name, , type]) => [
        name,
        type === "boolean"
          ? true
          : type === "integer"
            ? 3
            : type === "frequency"
              ? "daily"
              : `synthetic ${name}`,
      ]),
    );
    const payload = { requestId: randomUUID(), revision: before.revision, values };
    const first = await request(`/apps/example/settings/${section}`, "PUT", payload);
    expect(first.status).toBe(200);
    const result = await first.json();
    const replay = await request(`/apps/example/settings/${section}`, "PUT", payload);
    expect(await replay.json()).toEqual(result);
    expect((await configuration(section)).values).toEqual(values);
    expect(
      (await request(`/apps/example/settings/${section}`, "PUT", { ...payload, requestId: randomUUID() }))
        .status,
    ).toBe(409);
    expect(
      (await request(`/apps/example/settings/${section}`, "PUT", { ...payload, revision: result.revision }))
        .status,
    ).toBe(409);
    const audit = database.prepare("SELECT * FROM openhub_audit WHERE request_id=?").all(payload.requestId);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain("synthetic notes");
  }
  expect(database.prepare("SELECT popup_version FROM app_config").get()?.popup_version).toBe(1);
  expect((await request("/audit")).status).toBe(200);
});
it("rolls back a configuration change when audit persistence fails", async () => {
  const before = await configuration("notes");
  await request("/audit");
  database.exec(
    "CREATE TRIGGER reject_audit BEFORE INSERT ON openhub_audit BEGIN SELECT RAISE(ABORT,'fixture failure'); END",
  );
  const requestId = randomUUID();
  expect(
    (
      await request("/apps/example/settings/notes", "PUT", {
        requestId,
        revision: before.revision,
        values: { notes: "must roll back" },
      })
    ).status,
  ).toBe(503);
  expect((await configuration("notes")).values.notes).toBe("");
  expect(database.prepare("SELECT * FROM openhub_operations WHERE id=?").all(requestId)).toHaveLength(0);
});
it("rejects malformed fields and resolves concurrent stale saves to one effect", async () => {
  const before = await configuration("notes");
  expect(
    (
      await request("/apps/example/settings/notes", "PUT", {
        requestId: randomUUID(),
        revision: before.revision,
        values: { notes: "test", fcm_service_account: "forbidden" },
      })
    ).status,
  ).toBe(400);
  const responses = await Promise.all(
    ["first", "second"].map((notes) =>
      request("/apps/example/settings/notes", "PUT", {
        requestId: randomUUID(),
        revision: before.revision,
        values: { notes },
      }),
    ),
  );
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(database.prepare("SELECT * FROM openhub_operations").all()).toHaveLength(1);
});
