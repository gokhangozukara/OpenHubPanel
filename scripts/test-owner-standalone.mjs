import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.env.OPERATOR_TEST_OUTPUT;
if (!output) throw new Error("OPERATOR_TEST_OUTPUT required");
mkdirSync(output, { recursive: true });
const fixture = mkdtempSync(path.join(output, "independent-"));
const openssl = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl";
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
const proxy = createServer(
  { key: readFileSync(path.join(fixture, "test.key")), cert: readFileSync(path.join(fixture, "test.crt")) },
  (incoming, outgoing) => {
    const remote = request(
      {
        hostname: "127.0.0.1",
        port: 3183,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, "x-openhub-client-ip": "127.0.0.1" },
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
      },
    );
    remote.on("error", () => {
      if (outgoing.headersSent || outgoing.destroyed) {
        outgoing.destroy();
        return;
      }
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(remote);
  },
);
await new Promise((resolve) => proxy.listen(3184, "127.0.0.1", resolve));
const origin = "https://127.0.0.1:3184";
const env = {
  ...process.env,
  OPENHUB_OPERATOR: "1",
  OPERATOR_DATA_MODE: "embedded",
  OPENHUB_BASE_PATH: "/openhub",
  OPERATOR_STATE_FILE: path.join(fixture, "identity.sqlite"),
  OPERATOR_KEY: randomBytes(32).toString("hex"),
  OPERATOR_EMAIL: "independent@example.invalid",
  APP_ORIGIN: origin,
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.PILOT_UPSTREAM_ORIGIN;
delete env.OPERATOR_CONNECTOR_TOKEN;
const activation = execFileSync(process.execPath, ["--import", "tsx", "scripts/operator-bootstrap.ts"], {
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
  env: { ...env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3183" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => (logs += chunk));
child.stderr.on("data", (chunk) => (logs += chunk));
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:3183/openhub/live")).ok) break;
    } catch {}
    if (attempt === 59) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(activation);
  await page.getByRole("button", { name: "Fox", exact: true }).click();
  const password = randomBytes(24).toString("base64url");
  await page.getByLabel("Choose a password (at least 6 characters)", { exact: true }).fill(password);
  await page.getByLabel("Google Authenticator on every sign-in (optional)", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Applications", exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("0 applications", { exact: true })).toBeVisible();
  await page.locator("aside").getByRole("button", { name: "Connections", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Getting started", exact: true })).toBeVisible();
  await page.getByText("Install a new independent panel", { exact: true }).click();
  await expect(page.getByText(/node setup.mjs/)).toBeVisible();
  await page.screenshot({ path: path.join(output, "first-installation.png"), fullPage: true });
  await page.locator("aside").getByRole("button", { name: "Add application", exact: true }).click();
  await page.getByLabel("Application name", { exact: true }).fill("Independent application");
  await page.getByLabel("Application ID", { exact: true }).fill("independent-app");
  await page.getByLabel("Confirm with your password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Independent application", exact: true })).toBeVisible();
  await expect(page.getByLabel("Configuration URL", { exact: true })).toHaveValue(
    `${origin}/openhub/api/config/independent-app`,
  );
  let config = await (await context.request.get(`${origin}/openhub/api/config/independent-app`)).json();
  assert.equal(config.app, "independent-app");
  assert.equal(config.ads.banner_1_active, false);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByLabel("Private notes", { exact: true }).fill("Private independent installation note");
  await page.getByLabel("Confirm with your password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Saved and recorded in the activity history.", { exact: true })).toBeVisible();
  config = await (await context.request.get(`${origin}/openhub/api/config/independent-app`)).json();
  assert.ok(!JSON.stringify(config).includes("Private independent"));
  await page.locator("aside").getByRole("button", { name: "Connections", exact: true }).click();
  await page.locator(".page-heading").getByRole("button", { name: "Add connection", exact: true }).click();
  await page.getByLabel("Connection type", { exact: true }).selectOption("link");
  await page.getByLabel("Connection name", { exact: true }).fill("Independent tools");
  await page.getByLabel("Panel URL", { exact: true }).fill("https://tools.example.com/manage");
  await page.getByLabel("Confirm with your password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Save shortcut", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open panel", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, "independent-connections-mobile.png"), fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        scenarios: [
          "independent activation without host connector",
          "empty first-use screen",
          "application creation and real public API",
          "private notes excluded from public response",
          "connection registration and setup instructions",
          "390px layout",
        ],
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("Independent installation browser checks passed:", output);
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exit = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exit;
  }
  await new Promise((resolve) => proxy.close(resolve));
}
