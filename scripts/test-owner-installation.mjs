import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { generate } = webRequire("otplib");
const express = require("express"),
  sqlite3 = require("sqlite3");
const createConnector = require("../infra/connectors/hubstag.cjs");
const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.env.OPERATOR_TEST_OUTPUT ?? mkdtempSync(path.join(tmpdir(), "openhub-owner-browser-"));
mkdirSync(output, { recursive: true });
const fixture = mkdtempSync(path.join(output, "fixture-"));
const sourceFile = path.join(fixture, "catalog.sqlite");
const identityFile = path.join(fixture, "identity.sqlite");
const key = randomBytes(32).toString("base64url");
const keyFile = path.join(fixture, "connector.key");
writeFileSync(keyFile, key);
const db = new DatabaseSync(sourceFile);
const fields = Object.values(createConnector.sections)
  .flat()
  .map(
    ([name, , type]) =>
      `${name} ${["boolean", "integer"].includes(type) ? "INTEGER DEFAULT 0" : "TEXT DEFAULT ''"}`,
  );
db.exec(
  `CREATE TABLE apps(slug TEXT PRIMARY KEY,name TEXT,category TEXT,package TEXT,sort INTEGER); CREATE TABLE app_config(slug TEXT PRIMARY KEY,${fields.join(",")},popup_version INTEGER DEFAULT 0,updated_at TEXT,fcm_service_account TEXT DEFAULT 'synthetic-only'); INSERT INTO apps VALUES('example','Example','Tools','invalid.example',0); INSERT INTO app_config(slug,popup_frequency,latest_version) VALUES('example','once','1.0.0');`,
);
const fixtureApp = express();
fixtureApp.use(express.json());
fixtureApp.use(
  "/internal/openhub",
  createConnector({ express, sqlite3, databasePath: sourceFile, keyFile, account: "fixture-owner" }),
);
fixtureApp.get("/api/v1/apps/example/config", (_req, res) =>
  res.json({ app: "example", ads: {}, update: {} }),
);
const upstream = createServer(fixtureApp);
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamPort = upstream.address().port;
const openssl =
  process.env.OPENSSL_BINARY ??
  (process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl");
execFileSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    path.join(fixture, "test.key"),
    "-out",
    path.join(fixture, "test.crt"),
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore" },
);
const proxy = createSecureServer(
  { key: readFileSync(path.join(fixture, "test.key")), cert: readFileSync(path.join(fixture, "test.crt")) },
  (incoming, outgoing) => {
    const target = httpRequest(
      {
        hostname: "127.0.0.1",
        port: 3181,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, "x-openhub-client-ip": "127.0.0.1" },
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
      },
    );
    target.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(target);
  },
);
await new Promise((resolve) => proxy.listen(3182, "127.0.0.1", resolve));
const origin = "https://127.0.0.1:3182";
const env = {
  ...process.env,
  OPENHUB_OPERATOR: "1",
  OPENHUB_PILOT: "1",
  OPENHUB_BASE_PATH: "/openhub",
  OPERATOR_STATE_FILE: identityFile,
  OPERATOR_KEY: randomBytes(32).toString("hex"),
  OPERATOR_EMAIL: "owner@example.invalid",
  OPERATOR_CONNECTOR_TOKEN: key,
  PILOT_DATA_FILE: sourceFile,
  PILOT_UPSTREAM_ORIGIN: `http://127.0.0.1:${upstreamPort}`,
  APP_ORIGIN: origin,
  NEXT_TELEMETRY_DISABLED: "1",
};
const bootstrapURL = execFileSync(process.execPath, ["--import", "tsx", "scripts/operator-bootstrap.ts"], {
  cwd: root,
  env,
  encoding: "utf8",
}).trim();
cpSync(
  path.join(root, "apps/web/.next/static"),
  path.join(root, "apps/web/.next/standalone/apps/web/.next/static"),
  { recursive: true },
);
const child = spawn(process.execPath, [path.join(root, "apps/web/.next/standalone/apps/web/server.js")], {
  cwd: root,
  env: { ...env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3181" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:3181/openhub/live")).status === 200) break;
    } catch {
      /* Wait for the local artifact. */
    }
    if (attempt === 59) throw new Error(`Artifact did not start: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(bootstrapURL);
  assert.equal(response.status(), 200);
  assert.ok(!response.headers()["content-security-policy"].includes("unsafe-inline"));
  await expect(page.getByRole("heading", { name: "Activate your live account" })).toBeVisible();
  assert.equal(
    (await context.request.get(`${origin}/openhub/api/operator/settings/example/notes`)).status(),
    401,
  );
  assert.equal(
    (
      await context.request.put(`${origin}/openhub/api/operator/settings/example/notes`, {
        data: {},
        headers: { origin: "https://attacker.invalid" },
      })
    ).status(),
    403,
  );
  const password = `Synthetic browser owner ${randomBytes(24).toString("hex")}`;
  await page.getByLabel("Choose a password (at least 15 characters)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible({
    timeout: 15000,
  });
  assert.equal(
    (await context.request.get(`${origin}/openhub/api/operator/settings/example/notes`)).status(),
    401,
  );
  await page.getByText("Enter the key manually", { exact: true }).click();
  const secret = await page.locator(".owner-secret").textContent();
  await page.getByLabel("Authenticator code", { exact: true }).fill(await generate({ secret }));
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  const recoveryCodes = await page.locator(".owner-code").allTextContents();
  assert.equal(recoveryCodes.length, 8);
  await page.getByRole("button", { name: "I saved my codes. Open my panel" }).click();
  await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check all connections" }).click();
  await expect(page.getByText("API reachable", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage application", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByLabel("Private notes", { exact: true }).fill("Synthetic production browser round-trip");
  const before = Math.floor(Date.now() / 30000);
  console.log(
    "Production browser: MFA, pre-session denial, exact-origin/CSRF checks and catalog passed; waiting for a fresh TOTP step.",
  );
  while (Math.floor(Date.now() / 30000) === before) await new Promise((resolve) => setTimeout(resolve, 500));
  await page.getByLabel("Confirm with a new authenticator code").fill(await generate({ secret }));
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Saved and recorded in the activity history.", { exact: true })).toBeVisible();
  assert.equal(
    db.prepare("SELECT notes FROM app_config").get().notes,
    "Synthetic production browser round-trip",
  );
  await page.locator(".language-selector select").selectOption("tr");
  await expect(page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(output, "owner-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "owner-mobile.png"), fullPage: true });
  await page.locator(".language-selector select").selectOption("de");
  await expect(page.getByRole("button", { name: "Änderungen speichern", exact: true })).toBeVisible();
  await page.locator(".language-selector select").selectOption("en");
  await page.getByRole("button", { name: "Security and activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Configuration history", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "notes", exact: true })).toHaveCount(1);
  const oldCookies = await context.cookies();
  const oldSession = oldCookies.find((cookie) => cookie.name === "__Host-hubpanel_session");
  assert.ok(oldSession?.secure && oldSession?.httpOnly && oldSession?.path === "/");
  await page.getByRole("button", { name: "Sign out on all devices", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  assert.equal(
    (
      await context.request.get(`${origin}/openhub/api/operator/settings/example/notes`, {
        headers: { cookie: `__Host-hubpanel_session=${oldSession.value}` },
      })
    ).status(),
    401,
  );
  await page.getByLabel("Email", { exact: true }).fill("owner@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Use a recovery code", exact: true }).click();
  await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCodes[0]);
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your authenticator", exact: true })).toBeVisible();
  assert.equal(
    (await context.request.get(`${origin}/openhub/api/operator/settings/example/notes`)).status(),
    401,
  );
  await page.getByText("Enter the key manually", { exact: true }).click();
  const replacementSecret = await page.locator(".owner-secret").textContent();
  assert.notEqual(secret, replacementSecret);
  await page
    .getByLabel("Authenticator code", { exact: true })
    .fill(await generate({ secret: replacementSecret }));
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Save your recovery codes", exact: true })).toBeVisible();
  const backupEnv = {
    ...env,
    OPERATOR_BACKUP_KEY: randomBytes(32).toString("hex"),
    OPERATOR_BACKUP_DIR: path.join(fixture, "encrypted-backups"),
  };
  const backupFile = execFileSync(process.execPath, ["scripts/operator-backup.mjs"], {
    cwd: root,
    env: backupEnv,
    encoding: "utf8",
  }).trim();
  const restoredFile = path.join(fixture, "restored.sqlite");
  execFileSync(process.execPath, ["scripts/operator-backup.mjs", "restore-test", backupFile, restoredFile], {
    cwd: root,
    env: backupEnv,
    stdio: "pipe",
  });
  const restored = new DatabaseSync(restoredFile);
  try {
    assert.equal(restored.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.equal(restored.prepare("SELECT recovery_required FROM operator_user").get().recovery_required, 1);
    assert.equal(
      restored.prepare("SELECT count(*) AS count FROM operator_session WHERE revoked=0").get().count,
      0,
    );
    assert.equal(restored.prepare("SELECT count(*) AS count FROM operator_recovery").get().count, 0);
  } finally {
    restored.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        scenarios: [
          "production nonce CSP and hydration",
          "password/TOTP bootstrap",
          "no management before MFA",
          "exact origin and CSRF rejection",
          "live catalog/probe",
          "native settings write and audit",
          "three languages",
          "390px layout",
          "logout-all and old-session rejection",
          "restricted recovery and replacement enrollment",
          "encrypted snapshot and restore with old authority revoked",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("Production owner browser checks passed. Evidence:", output);
} catch (error) {
  writeFileSync(path.join(output, "server.log"), logs);
  throw error;
} finally {
  await browser?.close();
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
  db.close();
}
