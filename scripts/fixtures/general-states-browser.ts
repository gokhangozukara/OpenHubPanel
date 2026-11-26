import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, expect, type Page } from "@playwright/test";
import type { Database } from "../../packages/db/src/index";

export async function checkGeneralStates({
  page,
  context,
  browser,
  admin,
  origin,
  workspaceA,
  workspaceB,
  fixture,
  check,
}: {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  admin: Database;
  origin: string;
  workspaceA: string;
  workspaceB: string;
  fixture: string;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  // Preserve the database last-owner invariant during isolated role/removal fixtures.
  const backupOwner = randomUUID();
  await admin`INSERT INTO users(id,display_name) VALUES(${backupOwner},'Fixture backup owner')`;
  await admin`INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES(${workspaceA},${backupOwner},'owner')`;
  const nav = (name: string) => page.getByRole("navigation").getByRole("button", { name, exact: true });
  const alert = page.locator("main").getByRole("alert");
  async function ready() {
    await expect(page.getByLabel("Workspace", { exact: true })).toBeEnabled();
    await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toHaveCount(0);
  }
  async function reload() {
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await ready();
    await page.getByLabel("Workspace", { exact: true }).selectOption(workspaceA);
    await ready();
  }
  async function axe(target = page) {
    const results = await new AxeBuilder({ page: target })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    assert.ok(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await check("initial loading, unreachable API and genuine browser offline recover safely", async () => {
    const guest = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
    const view = await guest.newPage();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await view.route("**/api/general/state", async (route) => {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    await view.goto(`${origin}/workspace`);
    await expect(view.getByRole("status")).toHaveText("Loading…");
    await axe(view);
    release();
    await view.unrouteAll({ behavior: "wait" });
    await expect(view.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    await view.route("**/api/general/state", (route) =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "unavailable" }),
    );
    await view.reload();
    await expect(view.locator("main").getByRole("alert")).toHaveText(
      "The service is unavailable. Please try again.",
    );
    await axe(view);
    await view.screenshot({ path: path.join(fixture, "login-error-desktop.png"), fullPage: true });
    await guest.close();
    await nav("Applications").click();
    await ready();
    const add = page.getByRole("form", { name: "Add application", exact: true });
    await add.getByLabel("Application name", { exact: true }).fill("Offline draft retained");
    await context.setOffline(true);
    await add.getByRole("button", { name: "Add application", exact: true }).click();
    await expect(alert).toHaveText("Connection lost. Check your network and retry.");
    await expect(add.getByLabel("Application name", { exact: true })).toHaveValue("Offline draft retained");
    await axe();
    await context.setOffline(false);
    await reload();
  });
  await check(
    "invalid and oversized forms focus errors, preserve drafts and never send requests",
    async () => {
      await nav("Applications").click();
      await ready();
      const add = page.getByRole("form", { name: "Add application", exact: true });
      const input = add.getByLabel("Application name", { exact: true });
      await add.getByRole("button", { name: "Add application", exact: true }).click();
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute("aria-invalid", "true");
      await expect(add.getByRole("alert")).toHaveText("Check the highlighted fields.");
      await input.evaluate((node) => {
        (node as HTMLInputElement).value = "X".repeat(101);
      });
      await add.getByRole("button", { name: "Add application", exact: true }).click();
      await expect(add.getByText("Use at most 100 characters.", { exact: true })).toBeVisible();
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await axe();
        await page.screenshot({ path: path.join(fixture, `form-error-${width}.png`), fullPage: true });
      }
      await axe();
      await reload();
    },
  );
  await check(
    "malformed successful responses cannot claim saved changes and unknown errors stay private",
    async () => {
      await nav("Applications").click();
      await ready();
      const form = page.getByRole("form", { name: "Add application", exact: true });
      await form.getByLabel("Application name", { exact: true }).fill("Unconfirmed draft");
      await page.route("**/api/general/application", (route) => route.fulfill({ status: 200, json: {} }));
      await form.getByRole("button").click();
      await expect(alert).toHaveText("The service is unavailable. Please try again.");
      await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toHaveCount(0);
      await page.unrouteAll({ behavior: "wait" });
      await page.route("**/api/general/application", (route) =>
        route.fulfill({ status: 500, json: { error: "private fixture details" } }),
      );
      await form.getByRole("button").click();
      await expect(alert).toHaveText("The request could not be completed. Review the details and try again.");
      await expect(form.getByLabel("Application name", { exact: true })).toHaveValue("Unconfirmed draft");
      await axe();
      await reload();
    },
  );
  await check("late real workspace responses and errors never overwrite any selected scope", async () => {
    const connection = randomUUID();
    const application = String(
      (
        await admin`SELECT id FROM applications WHERE workspace_id=${workspaceA} ORDER BY created_at LIMIT 1`
      )[0]?.id,
    );
    await admin`INSERT INTO workspace_connections(workspace_id,id,application_id,name,url,secret,disabled,revision) VALUES(${workspaceA},${connection},${application},'Scope A connection','https://scope.example.test','',true,${randomUUID()})`;
    await page.getByLabel("Workspace", { exact: true }).selectOption(workspaceB);
    await ready();
    for (const screen of ["Applications", "Connections", "Team members", "Activity log"]) {
      await nav(screen).click();
      await ready();
      for (const fail of [false, true]) {
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        let captured = () => {};
        const started = new Promise<void>((resolve) => {
          captured = resolve;
        });
        await page.route(`**/api/general/workspace?workspace=${workspaceA}`, async (route) => {
          const response = await route.fetch();
          captured();
          await gate;
          if (fail) await route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } });
          else await route.fulfill({ response });
        });
        const select = page.getByLabel("Workspace", { exact: true });
        await select.focus();
        await select.selectOption(workspaceA);
        await started;
        await expect(page.getByRole("status").filter({ hasText: "Loading…" })).toBeVisible();
        await select.selectOption(workspaceB);
        await ready();
        release();
        await page.unrouteAll({ behavior: "wait" });
        await expect(select).toHaveValue(workspaceB);
        await expect(select).toBeFocused();
        await expect(alert).toHaveCount(0);
        await expect(nav(screen)).toHaveAttribute("aria-current", "page");
        if (screen === "Applications")
          await expect(
            page.getByText("No applications yet. Add your first application.", { exact: true }),
          ).toBeVisible();
        if (screen === "Connections")
          await expect(page.getByText("No API connections yet.", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Workspace A application", exact: true })).toHaveCount(
          0,
        );
        await expect(page.getByRole("heading", { name: "Scope A connection", exact: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Fixture backup owner", exact: true })).toHaveCount(0);
        if (screen === "Activity log")
          await expect(page.getByText("Application created", { exact: true })).toHaveCount(0);
      }
    }
    await admin`DELETE FROM workspace_connections WHERE id=${connection}`;
    await page.getByLabel("Workspace", { exact: true }).selectOption(workspaceA);
    await ready();
    await nav("Applications").click();
    await ready();
  });
  await check("pending mutation blocks workspace switches and same-tick duplicate submissions", async () => {
    const add = page.getByRole("form", { name: "Add application", exact: true });
    await add.getByLabel("Application name", { exact: true }).fill("Exactly once browser application");
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let count = 0;
    await page.route("**/api/general/application", async (route) => {
      count++;
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });
    await add.getByRole("button", { name: "Add application", exact: true }).evaluate((node) => {
      (node as HTMLButtonElement).click();
      (node as HTMLButtonElement).click();
    });
    await expect(page.getByLabel("Workspace", { exact: true })).toBeDisabled();
    await expect(add.getByRole("button")).toBeDisabled();
    release();
    await page.unrouteAll({ behavior: "wait" });
    await ready();
    assert.equal(count, 1);
    assert.equal(
      (await admin`SELECT id FROM applications WHERE name='Exactly once browser application'`).length,
      1,
    );
    await expect(alert).toHaveCount(0);
  });
  await check(
    "real role downgrade, forged scope and removed membership show safe permission errors",
    async () => {
      const owner = String(
        (await admin`SELECT id FROM hub_identity.accounts WHERE email='browser-owner@example.test'`)[0]?.id,
      );
      for (const mode of ["role", "forged", "removed"]) {
        await reload();
        await nav("Applications").click();
        await ready();
        const add = page.getByRole("form", { name: "Add application", exact: true });
        await add.getByLabel("Application name", { exact: true }).fill(`Denied ${mode}`);
        if (mode === "role")
          await admin`UPDATE workspace_memberships SET role='viewer' WHERE workspace_id=${workspaceA} AND user_id=${owner}`;
        if (mode === "removed")
          await admin`UPDATE workspace_memberships SET active=false WHERE workspace_id=${workspaceA} AND user_id=${owner}`;
        if (mode === "forged")
          await page.route("**/api/general/application", (route) =>
            route.continue({
              postData: JSON.stringify({ ...route.request().postDataJSON(), workspace: randomUUID() }),
            }),
          );
        await add.getByRole("button", { name: "Add application", exact: true }).click();
        await expect(alert).toHaveText("You do not have permission for this action.");
        await axe();
        await admin`UPDATE workspace_memberships SET role='owner',active=true WHERE workspace_id=${workspaceA} AND user_id=${owner}`;
      }
      assert.equal((await admin`SELECT id FROM applications WHERE name LIKE 'Denied %'`).length, 0);
      await reload();
    },
  );
  await check("real expired sessions return to sign-in without stale workspace data", async () => {
    const cookie = (await context.cookies()).find((row) => row.name === "__Host-hubgeneral_session");
    assert.ok(cookie);
    const hash = createHash("sha256").update(cookie.value).digest("hex");
    await admin`UPDATE hub_identity.sessions SET created_at=now()-interval '31 days',seen_at=now()-interval '31 days' WHERE hash=${hash}`;
    await nav("Applications").click();
    await expect(alert).toHaveText("Your session ended. Please sign in again.");
    await axe();
    await admin`UPDATE hub_identity.sessions SET created_at=now(),seen_at=now() WHERE hash=${hash}`;
    await reload();
  });
  await check(
    "empty lists and long names remain accessible across desktop, tablet, mobile and zoom",
    async () => {
      const owner = String(
        (await admin`SELECT id FROM hub_identity.accounts WHERE email='browser-owner@example.test'`)[0]?.id,
      );
      const original = (await admin`SELECT display_name FROM users WHERE id=${owner}`)[0]?.display_name;
      await admin`UPDATE users SET display_name=${"LongUser".repeat(12)} WHERE id=${owner}`;
      await admin`UPDATE workspaces SET name=${"LongWorkspace".repeat(7)} WHERE id=${workspaceA}`;
      await admin`UPDATE applications SET name=${"LongApplication".repeat(6)} WHERE workspace_id=${workspaceA}`;
      await reload();
      await expect(page.getByLabel("Workspace", { exact: true }).locator("option:checked")).toHaveText(
        "LongWorkspace".repeat(7),
      );
      for (const width of [1280, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        assert.ok(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches));
        for (const name of [
          "Overview",
          "Applications",
          "Connections",
          "Team members",
          "Activity log",
          "Security",
        ]) {
          await nav(name).click();
          await ready();
          await axe();
          await page.route(`**/api/general/workspace?workspace=${workspaceA}`, async (route) => {
            const response = await route.fetch();
            const data = await response.json();
            await route.fulfill({
              response,
              json: { ...data, applications: [], members: [], invitations: [], events: [] },
            });
          });
          await page.route(`**/api/general/connections?workspace=${workspaceA}`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, json: [] });
          });
          await nav(name).click();
          await ready();
          await axe();
          const empty: Record<string, string> = {
            Applications: "No applications yet. Add your first application.",
            Connections: "No API connections yet.",
            "Team members": "No members yet.",
            "Activity log": "No activity yet.",
          };
          if (empty[name]) await expect(page.getByText(empty[name], { exact: true })).toBeVisible();
          await page.unrouteAll({ behavior: "wait" });
          await page.route(`**/api/general/workspace?workspace=${workspaceA}`, (route) =>
            route.fulfill({ status: 503, json: { error: "UNAVAILABLE" } }),
          );
          await nav(name).click();
          await expect(alert).toHaveText("The service is unavailable. Please try again.");
          await axe();
          if (width === 1280 || width === 390)
            await page.screenshot({
              path: path.join(fixture, `${name.replaceAll(" ", "-").toLowerCase()}-error-${width}.png`),
              fullPage: true,
            });
          await page.unrouteAll({ behavior: "wait" });
        }
      }
      await admin`UPDATE users SET display_name=${String(original)} WHERE id=${owner}`;
      await admin`UPDATE workspaces SET name='Browser workspace A' WHERE id=${workspaceA}`;
      const first =
        await admin`SELECT id FROM applications WHERE workspace_id=${workspaceA} ORDER BY created_at LIMIT 1`;
      await admin`UPDATE applications SET name='Workspace A application' WHERE id=${String(first[0]?.id)}`;
      await page.setViewportSize({ width: 1280, height: 900 });
      await reload();
    },
  );

  await check(
    "expired, cancelled, replaced, used and unauthorized invitation links fail safely",
    async () => {
      const owner = String(
        (await admin`SELECT id FROM hub_identity.accounts WHERE email='browser-owner@example.test'`)[0]?.id,
      );
      for (const state of ["expired", "cancelled", "replaced", "used", "authority"]) {
        const token = randomBytes(32).toString("base64url");
        const hash = createHash("sha256").update(token).digest("hex");
        const id = randomUUID();
        await admin`INSERT INTO workspace_invitations(workspace_id,id,email,role,inviter_id,token_hash) VALUES(${workspaceA},${id},${`${state}@example.test`},'viewer',${owner},${hash})`;
        if (state === "expired")
          await admin`UPDATE workspace_invitations SET expires_at=now()-interval '1 second' WHERE id=${id}`;
        if (state === "cancelled" || state === "replaced")
          await admin`UPDATE workspace_invitations SET cancelled=true WHERE id=${id}`;
        if (state === "used") await admin`UPDATE workspace_invitations SET accepted=true WHERE id=${id}`;
        if (state === "authority")
          await admin`UPDATE workspace_memberships SET role='viewer' WHERE workspace_id=${workspaceA} AND user_id=${owner}`;
        const guest = await browser.newContext({ ignoreHTTPSErrors: true, locale: "en-US" });
        const view = await guest.newPage();
        try {
          await view.goto(`${origin}/workspace#invite=${token}`);
          const form = view.getByRole("form", { name: "Join with invitation", exact: true });
          await expect(form.getByRole("button")).toBeEnabled();
          await form.getByLabel("Password", { exact: true }).fill(`T${randomBytes(5).toString("hex")}`);
          await form.getByRole("button").click();
          await expect(view.locator("main").getByRole("alert")).toHaveText(
            "This invitation is invalid, expired or already used.",
          );
          await axe(view);
        } finally {
          await guest.close();
          await admin`UPDATE workspace_memberships SET role='owner' WHERE workspace_id=${workspaceA} AND user_id=${owner}`;
        }
      }
      await reload();
    },
  );
  await admin`DELETE FROM workspace_memberships WHERE workspace_id=${workspaceA} AND user_id=${backupOwner}`;
  await admin`DELETE FROM users WHERE id=${backupOwner}`;
}
