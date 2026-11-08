import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { createServer } from "node:https";
import { createRequire } from "node:module";
import { createServer as tcpServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium, expect } from "@playwright/test";
import EmbeddedPostgres from "embedded-postgres";
import { createDatabase } from "../packages/db/src/index";
import { contentService } from "./fixtures/content-service";
import { checkIndependentBrowser } from "./fixtures/general-http-browser";
import { checkGeneralStates } from "./fixtures/general-states-browser";

const root = process.cwd();
const webRequire = createRequire(path.join(root, "apps/web/package.json"));
const { generate } = webRequire("otplib") as { generate: (options: { secret: string }) => Promise<string> };
await mkdir(path.join(root, ".local"), { recursive: true });
const fixture = await mkdtemp(path.join(root, ".local", "general-browser-"));
async function freePort() {
  const server = tcpServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}
const pgPort = await freePort();
const webPort = await freePort();
const tlsPort = await freePort();
const password = randomBytes(32).toString("hex");
const appPassword = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
const engine = new EmbeddedPostgres({
  databaseDir: path.join(fixture, "postgres"),
  user: "postgres",
  password,
  port: pgPort,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => {},
});
const origin = `https://127.0.0.1:${tlsPort}`;
let admin: ReturnType<typeof createDatabase> | undefined;
let app: ReturnType<typeof createDatabase> | undefined;
let child: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let proxy: ReturnType<typeof createServer> | undefined;
let remote: Awaited<ReturnType<typeof contentService>> | undefined;
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await engine.initialise();
  await engine.start();
  await engine.createDatabase("general_browser");
  admin = createDatabase(`postgresql://postgres:${password}@127.0.0.1:${pgPort}/general_browser`);
  const migrationEnv = {
    ...process.env,
    GENERAL_MIGRATION_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${pgPort}/general_browser`,
  };
  for (let attempt = 0; attempt < 2; attempt++)
    execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate-general.ts"], {
      cwd: root,
      env: migrationEnv,
      stdio: "pipe",
    });
  assert.equal(Number((await admin`SELECT count(*) FROM hub_migrations`)[0]?.count), 4);
  await admin.unsafe(`ALTER ROLE openhub_app LOGIN PASSWORD '${appPassword}'`);
  const url = `postgresql://openhub_app:${appPassword}@127.0.0.1:${pgPort}/general_browser`;
  app = createDatabase(url);
  const bootstrap =
    execFileSync(process.execPath, ["--import", "tsx", "scripts/general-bootstrap.ts"], {
      cwd: root,
      env: { ...process.env, GENERAL_DATABASE_URL: url, GENERAL_ENCRYPTION_KEY: encryptionKey },
      encoding: "utf8",
    })
      .trim()
      .split(/\r?\n/)
      .at(-1) ?? "";
  assert.match(bootstrap, /^[A-Za-z0-9_-]{43}$/);
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
  proxy = createServer(
    {
      key: await readFile(path.join(fixture, "test.key")),
      cert: await readFile(path.join(fixture, "test.crt")),
    },
    (incoming, outgoing) => {
      const remote = request(
        {
          hostname: "127.0.0.1",
          port: webPort,
          path: incoming.url,
          method: incoming.method,
          headers: { ...incoming.headers, "x-openhub-client-ip": "127.0.0.1" },
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
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
  await new Promise<void>((resolve) => proxy?.listen(tlsPort, "127.0.0.1", resolve));
  await cp(
    path.join(root, "apps/web/.next/static"),
    path.join(root, "apps/web/.next/standalone/apps/web/.next/static"),
    { recursive: true },
  );
  remote = await contentService(fixture);
  child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(path.join(root, "scripts/general-test-fetch.mjs")).href,
      "--import",
      pathToFileURL(path.join(root, "scripts/general-test-network.mjs")).href,
      path.join(root, "apps/web/.next/standalone/apps/web/server.js"),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENHUB_TEST_TRANSPORT_FILE: remote.metadata,
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: String(webPort),
        APP_ORIGIN: origin,
        GENERAL_ENABLED: "1",
        GENERAL_DATABASE_URL: url,
        GENERAL_ENCRYPTION_KEY: encryptionKey,
        GENERAL_TRUST_PROXY: "1",
        OPENHUB_OPERATOR: "0",
        OPENHUB_BASE_PATH: "",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let logs = "";
  child.stdout?.on("data", (chunk) => {
    logs += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    logs += String(chunk);
  });
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`http://127.0.0.1:${webPort}/api/health`)).ok) break;
    } catch {}
    if (attempt >= 60) {
      await writeFile(path.join(fixture, "server.log"), logs);
      throw new Error("General browser fixture failed to start; inspect its local server.log.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:"))
      consoleErrors.push(message.text());
  });
  async function authAxe() {
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.deepEqual(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map(
          (row) => row.id,
        ),
        [],
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const userPassword = `T${randomBytes(3).toString("hex").slice(0, 5)}`;
  let secret = "";
  await check("general production UI bootstraps once and requires authenticator enrollment", async () => {
    await page.goto(`${origin}/workspace`);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    await authAxe();
    const login = page.getByRole("form", { name: "Sign in", exact: true });
    await login.getByLabel("Email", { exact: true }).fill("unknown@example.test");
    await login.getByLabel("Password", { exact: true }).fill(userPassword);
    await login.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Sign-in details could not be verified.",
    );
    await authAxe();
    const form = page.getByRole("form", { name: "First installation", exact: true });
    await form.getByLabel("Setup token", { exact: true }).fill(bootstrap);
    await form.getByLabel("Email", { exact: true }).fill("browser-owner@example.test");
    await form.getByLabel("Password", { exact: true }).fill(userPassword);
    await form.getByRole("button", { name: "Start setup", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Set up your authenticator", exact: true })).toBeVisible();
    secret = (await page.locator("pre").textContent()) ?? "";
    await authAxe();
    const verify = page.getByRole("form", { name: "Verify authenticator", exact: true });
    await expect(verify.getByLabel("Current authenticator code", { exact: true })).toHaveAttribute(
      "autocomplete",
      "one-time-code",
    );
    await expect(verify.getByLabel("Current authenticator code", { exact: true })).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    await verify
      .getByLabel("Current authenticator code", { exact: true })
      .fill((await generate({ secret })) === "000000" ? "111111" : "000000");
    await verify.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The authenticator code is invalid or already used. Wait for a new code.",
    );
    await authAxe();
    await verify.getByLabel("Current authenticator code", { exact: true }).fill(await generate({ secret }));
    await verify.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
    await expect(page.getByText("You do not have a workspace yet.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "I saved my codes", exact: true }).click();
    await authAxe();
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "__Host-hubgeneral_session");
    assert.ok(session?.secure && session.httpOnly && session.sameSite === "Strict");
    assert.equal(pageErrors.length, 0);
  });
  let workspaceA = "";
  let workspaceB = "";
  await check("real UI creates two workspaces and scoped application forms", async () => {
    const create = page.getByRole("form", { name: "Create workspace", exact: true });
    await create.getByLabel("Workspace name", { exact: true }).fill("Browser workspace A");
    await create.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect(page.getByLabel("Workspace", { exact: true })).not.toHaveValue("");
    workspaceA = await page.getByLabel("Workspace", { exact: true }).inputValue();
    await page.getByRole("navigation").getByRole("button", { name: "Applications", exact: true }).click();
    const add = page.getByRole("form", { name: "Add application", exact: true });
    await add.getByLabel("Application name", { exact: true }).fill("Workspace A application");
    await add.getByLabel("Application name", { exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "Workspace A application", exact: true })).toBeVisible();
    await page.getByRole("navigation").getByRole("button", { name: "Overview", exact: true }).click();
    await create.getByLabel("Workspace name", { exact: true }).fill("Browser workspace B");
    await create.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect(page.getByLabel("Workspace", { exact: true })).not.toHaveValue(workspaceA);
    workspaceB = await page.getByLabel("Workspace", { exact: true }).inputValue();
    await page.getByRole("navigation").getByRole("button", { name: "Applications", exact: true }).click();
    await expect(
      page.getByText("No applications yet. Add your first application.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workspace A application", exact: true })).toHaveCount(0);
    await page.getByLabel("Workspace", { exact: true }).selectOption(workspaceA);
    await expect(page.getByRole("heading", { name: "Workspace A application", exact: true })).toBeVisible();
  });
  async function freshCode() {
    assert.ok(admin);
    for (;;) {
      const rows =
        await admin`SELECT last_step FROM hub_identity.factors f JOIN hub_identity.accounts a ON a.id=f.user_id WHERE a.email='browser-owner@example.test'`;
      if (Math.floor(Date.now() / 30000) > Number(rows[0]?.last_step)) return generate({ secret });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await checkGeneralStates({ page, context, browser, admin, origin, workspaceA, workspaceB, fixture, check });
  await checkIndependentBrowser({
    page,
    context,
    admin,
    remote,
    origin,
    workspace: workspaceA,
    freshCode,
    check,
  });
  let invitation = "";
  await check(
    "real connection form encrypts its key, reports a failed test honestly and disables access",
    async () => {
      await page.getByRole("navigation").getByRole("button", { name: "Connections", exact: true }).click();
      const form = page.getByRole("form", { name: "Add API connection", exact: true });
      const credential = randomBytes(32).toString("base64url");
      await form.getByLabel("Connection name", { exact: true }).fill("Browser API fixture");
      await form.getByLabel("API base URL", { exact: true }).fill("https://api.invalid");
      await form.getByLabel("API key", { exact: true }).fill(credential);
      await form.getByLabel("I approve sending this API key to this URL", { exact: true }).check();
      await form.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
      await form.getByRole("button", { name: "Add connection", exact: true }).click();
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: "Browser API fixture", exact: true }) });
      await expect(card).toBeVisible();
      assert.ok(admin);
      const rows =
        await admin`SELECT id,secret,write_enabled FROM workspace_connections WHERE name='Browser API fixture'`;
      assert.notEqual(rows[0]?.secret, credential);
      assert.equal(rows[0]?.write_enabled, false);
      assert.ok(
        !(
          await (
            await context.request.get(`${origin}/api/general/connections?workspace=${workspaceA}`)
          ).text()
        ).includes(credential),
      );
      await card.getByRole("button", { name: "Test connection", exact: true }).click();
      await expect(card.getByText(/Unavailable/)).toBeVisible();
      const manage = card.getByRole("form", { name: "Manage connection", exact: true });
      await manage.getByLabel("Action", { exact: true }).selectOption("disable");
      await manage.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
      await manage.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(card.getByText(/Disabled/)).toBeVisible();
      assert.equal(
        (await admin`SELECT secret FROM workspace_connections WHERE id=${rows[0]?.id}`)[0]?.secret,
        "",
      );
      assert.equal(
        (
          await context.request.get(
            `${origin}/api/general/connections/${rows[0]?.id}/articles?workspace=${workspaceA}`,
          )
        ).status(),
        400,
      );
    },
  );
  await check("owner creates an actual one-use invitation link without claiming email delivery", async () => {
    await page.getByRole("navigation").getByRole("button", { name: "Team members", exact: true }).click();
    const form = page.getByRole("form", { name: "Invite member", exact: true });
    await form.getByLabel("Email", { exact: true }).fill("browser-invited@example.test");
    await form.getByLabel("Role", { exact: true }).selectOption("viewer");
    await form.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await form.getByRole("button", { name: "Create invitation link", exact: true }).click();
    await expect(page.getByLabel("One-use invitation link", { exact: true })).toBeVisible();
    invitation = await page.getByLabel("One-use invitation link", { exact: true }).inputValue();
    await expect(
      page.getByText("No email is sent. Copy the invitation link and share it privately.", { exact: true }),
    ).toBeVisible();
  });
  const invitedContext = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
  const invitedPage = await invitedContext.newPage();
  await check("second user enrolls mandatory TOTP and accepts the invitation exactly once", async () => {
    await invitedPage.goto(invitation);
    const form = invitedPage.getByRole("form", { name: "Join with invitation", exact: true });
    await form.getByLabel("Password", { exact: true }).fill(randomBytes(24).toString("base64url"));
    await form.getByRole("button", { name: "Create invited account", exact: true }).click();
    await expect(
      invitedPage.getByRole("heading", { name: "Set up your authenticator", exact: true }),
    ).toBeVisible();
    const invitedSecret = (await invitedPage.locator("pre").textContent()) ?? "";
    const verify = invitedPage.getByRole("form", { name: "Verify authenticator", exact: true });
    await verify
      .getByLabel("Current authenticator code", { exact: true })
      .fill(await generate({ secret: invitedSecret }));
    await verify.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(invitedPage.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
    await invitedPage.getByRole("button", { name: "I saved my codes", exact: true }).click();
    await invitedPage.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await expect(invitedPage.getByLabel("Workspace", { exact: true })).toHaveValue(workspaceA);
    await invitedPage
      .getByRole("navigation")
      .getByRole("button", { name: "Applications", exact: true })
      .click();
    await expect(
      invitedPage.getByRole("heading", { name: "Workspace A application", exact: true }),
    ).toBeVisible();
    await expect(invitedPage.getByRole("form", { name: "Add application", exact: true })).toHaveCount(0);
    const proof = new URLSearchParams(new URL(invitation).hash.slice(1)).get("invite");
    const result = await invitedPage.evaluate(async (token) => {
      const state = await (await fetch("/api/general/state")).json();
      const response = await fetch("/api/general/accept-invitation", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": state.csrf },
        body: JSON.stringify({ token }),
      });
      return response.status;
    }, proof);
    assert.equal(result, 400);
  });
  await check("direct forged workspace and viewer mutation requests cannot change or leak data", async () => {
    const denied = await invitedPage.evaluate(
      async ({ workspace, name }) => {
        const state = await (await fetch("/api/general/state")).json();
        const read = await fetch(`/api/general/workspace?workspace=${workspace}`);
        const write = await fetch("/api/general/application", {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": state.csrf },
          body: JSON.stringify({ workspace, name }),
        });
        return { read: read.status, write: write.status, data: await read.text() };
      },
      { workspace: workspaceB, name: "Forged application" },
    );
    assert.equal(denied.read, 403);
    assert.equal(denied.write, 403);
    assert.ok(!denied.data.includes("Browser workspace B"));
    const noCsrf = await invitedContext.request.post(`${origin}/api/general/application`, {
      data: { workspace: workspaceA, name: "Forged" },
      headers: { origin },
    });
    assert.equal(noCsrf.status(), 403);
    assert.ok(admin);
    assert.equal(
      (await admin`SELECT id FROM applications WHERE name IN ('Forged','Forged application')`).length,
      0,
    );
  });
  await check("real workspace screens fit mobile, translate and pass automated WCAG AA checks", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of [
      "Overview",
      "Applications",
      "Connections",
      "Team members",
      "Activity log",
      "Security",
    ]) {
      await page.getByRole("navigation").getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByRole("heading", { name: tab, exact: true })).toBeVisible();
      assert.equal(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
          .length,
        0,
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.getByLabel("Language", { exact: true }).selectOption("tr");
    await expect(page.getByRole("heading", { name: "Çalışma alanların", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await page.locator(".language-selector select").selectOption("de");
    await expect(page.getByRole("heading", { name: "Deine Arbeitsbereiche", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    assert.equal(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
        .length,
      0,
    );
    await page.locator(".language-selector select").selectOption("en");
    await page.screenshot({ path: path.join(fixture, "general-mobile.png"), fullPage: true });
  });
  await check("membership removal denies old pages and requests on their next access", async () => {
    assert.ok(admin);
    const users =
      await admin`SELECT id FROM hub_identity.accounts WHERE email='browser-invited@example.test'`;
    const invitedId = String(users[0]?.id);
    await page.getByRole("navigation").getByRole("button", { name: "Team members", exact: true }).click();
    const article = page.locator("article").filter({ has: page.getByText(invitedId, { exact: true }) });
    const form = article.getByRole("form", { name: "Manage member", exact: true });
    await form.getByLabel("Keep membership active", { exact: true }).uncheck();
    await form.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await form.getByRole("button", { name: "Save member", exact: true }).click();
    await expect(article.getByText("Removed", { exact: false })).toBeVisible();
    const response = await invitedContext.request.get(
      `${origin}/api/general/workspace?workspace=${workspaceA}`,
    );
    assert.equal(response.status(), 403);
    await invitedPage.reload();
    await expect(
      invitedPage.getByRole("heading", { name: "Workspace A application", exact: true }),
    ).toHaveCount(0);
  });
  await check("logout from all devices revokes the cookie session immediately", async () => {
    const saved = await context.cookies();
    await page.getByRole("navigation").getByRole("button", { name: "Security", exact: true }).click();
    await page.getByRole("button", { name: "Sign out on all devices", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Workspace sign-in", exact: true })).toBeVisible();
    await context.addCookies(saved);
    const response = await context.request.get(`${origin}/api/general/workspace?workspace=${workspaceA}`);
    assert.equal(response.status(), 401);
    assert.equal(pageErrors.length, 0);
  });
  await check("six-character password login still requires a fresh authenticator code", async () => {
    const login = page.getByRole("form", { name: "Sign in", exact: true });
    async function keyboardTo(target: ReturnType<typeof page.getByLabel>) {
      for (let count = 0; count < 40; count++) {
        if (await target.evaluate((node) => document.activeElement === node)) return;
        await page.keyboard.press("Tab");
      }
      throw new Error("Keyboard cannot reach the requested control");
    }
    await keyboardTo(login.getByLabel("Email", { exact: true }));
    await page.keyboard.type("browser-owner@example.test");
    await keyboardTo(login.getByLabel("Password", { exact: true }));
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((value) => navigator.clipboard.writeText(value), userPassword);
    await page.keyboard.press("ControlOrMeta+V");
    assert.equal(
      (await login.getByLabel("Password", { exact: true }).inputValue()) === userPassword,
      true,
      "Clipboard paste must preserve the password",
    );
    await expect(login.getByLabel("Password", { exact: true })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    await keyboardTo(login.getByRole("button", { name: "Sign in", exact: true }));
    assert.ok(
      await login
        .getByRole("button", { name: "Sign in", exact: true })
        .evaluate((node) => getComputedStyle(node).outlineStyle !== "none"),
    );
    await login.getByRole("button", { name: "Sign in", exact: true }).press("Enter");
    await expect(page.getByRole("form", { name: "Verify authenticator", exact: true })).toBeVisible();
    assert.equal(
      (await (await context.request.get(`${origin}/api/general/state`)).json()).authenticated,
      false,
    );
    await keyboardTo(page.getByLabel("Current authenticator code", { exact: true }));
    await page.keyboard.type(await freshCode());
    await page.getByLabel("Current authenticator code", { exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  });
  console.log(`General production browser: ${passed} scenarios passed.`);
} finally {
  await browser?.close();
  await remote?.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exit = new Promise<void>((resolve) => child?.once("exit", () => resolve()));
    child.kill();
    await exit;
  }
  proxy?.closeAllConnections();
  if (proxy) await new Promise<void>((resolve) => proxy?.close(() => resolve()));
  await app?.end({ timeout: 5 });
  await admin?.end({ timeout: 5 });
  await engine.stop();
}
