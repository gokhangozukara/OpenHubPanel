import assert from "node:assert/strict";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, expect, type Page } from "@playwright/test";
import type { Database } from "../../packages/db/src/index";

export async function checkTrustedBrowser({
  page,
  context,
  browser,
  admin,
  origin,
  password,
  freshCode,
  fixture,
  check,
}: {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  admin: Database;
  origin: string;
  password: string;
  freshCode: () => Promise<string>;
  fixture: string;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const cookieName = "__Host-hubgeneral_trusted_device";
  const email = "browser-owner@example.test";
  async function login(target = page) {
    const form = target.getByRole("form", { name: "Sign in", exact: true });
    await expect(form.getByRole("button")).toBeEnabled();
    await form.getByLabel("Email", { exact: true }).fill(email);
    await form.getByLabel("Password", { exact: true }).fill(password);
    await form.getByRole("button").click();
  }
  async function signedIn() {
    await expect(page.getByRole("heading", { name: "Your workspaces", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toHaveCount(0);
  }
  async function signOut() {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Workspace sign-in", exact: true })).toBeVisible();
  }
  async function complete(remember = true) {
    const form = page.getByRole("form", { name: "Verify authenticator", exact: true });
    await expect(form).toBeVisible();
    await form.getByLabel("Trust this device for 30 days", { exact: true }).setChecked(remember);
    await form.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await form.getByRole("button", { name: "Verify", exact: true }).click();
    await signedIn();
  }
  await check(
    "trusted-device checkbox is opt-in, translated, accessible and issues private 30-day cookies",
    async () => {
      await signedIn();
      await signOut();
      await login();
      const form = page.getByRole("form", { name: "Verify authenticator", exact: true });
      await expect(form.getByLabel("Trust this device for 30 days", { exact: true })).not.toBeChecked();
      for (const [locale, label] of [
        ["en", "Trust this device for 30 days"],
        ["tr", "Bu cihaza 30 gün güven"],
        ["de", "Diesem Gerät 30 Tage vertrauen"],
      ] as const) {
        await page.locator(".language-selector select").selectOption(locale);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByLabel(String(label), { exact: true })).toBeVisible();
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          assert.deepEqual(
            (
              await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
            ).violations.map((row) => row.id),
            [],
          );
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
      }
      await page.locator(".language-selector select").selectOption("en");
      await page.screenshot({ path: path.join(fixture, "trusted-device-checkbox.png"), fullPage: true });
      const reply = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/general/complete") && response.request().method() === "POST",
      );
      await complete();
      const body = await (await reply).json();
      assert.equal(Object.hasOwn(body, "trustedDevice"), false);
      assert.equal(Object.hasOwn(body, "session"), false);
      const cookies = await context.cookies(),
        trust = cookies.find((cookie) => cookie.name === cookieName),
        binding = cookies.find((cookie) => cookie.name === "__Host-hubgeneral_browser");
      assert.ok(trust && binding);
      assert.ok(trust.secure && trust.httpOnly && trust.sameSite === "Strict" && trust.path === "/");
      assert.ok(
        trust.expires - Date.now() / 1000 > 29 * 86400 && trust.expires - Date.now() / 1000 <= 30 * 86400,
      );
      assert.ok(Math.abs(trust.expires - binding.expires) < 2);
      assert.equal(await page.evaluate(() => document.cookie.includes("hubgeneral_trusted")), false);
      const rows =
        await admin`SELECT hash,expires_at,created_at FROM hub_identity.trusted_devices d JOIN hub_identity.accounts a ON a.id=d.user_id WHERE a.email=${email} AND NOT revoked`;
      assert.equal(rows.length, 1);
      assert.ok(rows[0]?.hash !== trust.value);
    },
  );
  await check("remembered browser still needs its password and skips only the sign-in code", async () => {
    const before = (
      await admin`SELECT expires_at FROM hub_identity.trusted_devices d JOIN hub_identity.accounts a ON a.id=d.user_id WHERE a.email=${email} AND NOT revoked`
    )[0]?.expires_at;
    await signOut();
    const state = await (await context.request.get(`${origin}/api/general/state`)).json();
    assert.equal(state.authenticated, false);
    await login();
    await signedIn();
    await expect(page.getByRole("form", { name: "Verify authenticator", exact: true })).toHaveCount(0);
    assert.equal(
      new Date(
        (
          await admin`SELECT expires_at FROM hub_identity.trusted_devices d JOIN hub_identity.accounts a ON a.id=d.user_id WHERE a.email=${email} AND NOT revoked`
        )[0]?.expires_at,
      ).getTime(),
      new Date(before).getTime(),
    );
    const current = await (await context.request.get(`${origin}/api/general/state`)).json();
    const response = await context.request.post(`${origin}/api/general/invitation`, {
      headers: { origin, "x-csrf-token": current.csrf },
      data: {
        workspace: current.workspaces[0].id,
        email: "device-stepup@example.test",
        role: "viewer",
        code: "",
      },
    });
    assert.equal(response.status(), 400);
    assert.equal((await response.json()).error, "INVALID_CODE");
  });
  await check("copying only a remembered token into a fresh browser does not bypass TOTP", async () => {
    const trust = (await context.cookies()).find((cookie) => cookie.name === cookieName);
    assert.ok(trust);
    const fresh = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
    try {
      await fresh.addCookies([trust]);
      const view = await fresh.newPage();
      await view.goto(`${origin}/workspace`);
      await login(view);
      await expect(view.getByRole("form", { name: "Verify authenticator", exact: true })).toBeVisible();
      await expect(view.getByLabel("Trust this device for 30 days", { exact: true })).not.toBeChecked();
    } finally {
      await fresh.close();
    }
  });
  await check("forget-device and fixed server expiry restore the code prompt and opt-out", async () => {
    await page.getByRole("navigation").getByRole("button", { name: "Security", exact: true }).click();
    await page.getByRole("button", { name: "Forget this trusted device", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Device trust removed." })).toBeVisible();
    assert.equal(
      (await context.cookies()).some((cookie) => cookie.name === cookieName),
      false,
    );
    await signOut();
    await login();
    await complete();
    await admin`UPDATE hub_identity.trusted_devices SET created_at=now()-interval '31 days',expires_at=now()-interval '1 day' WHERE user_id=(SELECT id FROM hub_identity.accounts WHERE email=${email})`;
    await signOut();
    await login();
    await expect(page.getByRole("form", { name: "Verify authenticator", exact: true })).toBeVisible();
    await complete(false);
    assert.equal(
      (await context.cookies()).some((cookie) => cookie.name === cookieName),
      false,
    );
  });
  await check(
    "logout-all revokes remembered browser cookies even when an old cookie is restored",
    async () => {
      await signOut();
      await login();
      await complete();
      const saved = await context.cookies();
      await page.getByRole("navigation").getByRole("button", { name: "Security", exact: true }).click();
      await page.getByRole("button", { name: "Sign out on all devices", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Workspace sign-in", exact: true })).toBeVisible();
      assert.equal(
        (await context.cookies()).some((cookie) => cookie.name === cookieName),
        false,
      );
      await context.addCookies(saved);
      await login();
      await expect(page.getByRole("form", { name: "Verify authenticator", exact: true })).toBeVisible();
    },
  );
}
