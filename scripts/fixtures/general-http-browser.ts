import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { type BrowserContext, expect, type Page } from "@playwright/test";
import type { Database } from "../../packages/db/src/index";
import type { contentService } from "./content-service";

export async function checkIndependentBrowser({
  page,
  context,
  admin,
  remote,
  origin,
  workspace,
  freshCode,
  check,
}: {
  page: Page;
  context: BrowserContext;
  admin: Database;
  remote: Awaited<ReturnType<typeof contentService>>;
  origin: string;
  workspace: string;
  freshCode: () => Promise<string>;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  let usedCode = "";
  let connection = "";
  let revision = "";
  let first: Record<string, unknown> = {};
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Independent HTTPS API", exact: true }) });
  async function post(payload: Record<string, unknown>) {
    const state = await (await context.request.get(`${origin}/api/general/state`)).json();
    return context.request.post(`${origin}/api/general/article`, {
      headers: { origin, "x-csrf-token": state.csrf },
      data: { ...payload, workspace },
    });
  }
  await check("production UI connects a separate HTTPS process and enables writes with TOTP", async () => {
    await page.getByRole("navigation").getByRole("button", { name: "Connections", exact: true }).click();
    const form = page.getByRole("form", { name: "Add API connection", exact: true });
    await form.getByLabel("Connection name", { exact: true }).fill("Independent HTTPS API");
    await form.getByLabel("API base URL", { exact: true }).fill(remote.base);
    await form.getByLabel("API key", { exact: true }).fill(remote.credential);
    await form.getByLabel("I approve sending this API key to this URL", { exact: true }).check();
    usedCode = await freshCode();
    await form.getByLabel("Current authenticator code", { exact: true }).fill(usedCode);
    await form.getByRole("button", { name: "Add connection", exact: true }).click();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Test connection", exact: true }).click();
    await expect(card.getByText("Connected · Read only", { exact: true })).toBeVisible();
    const manage = card.getByRole("form", { name: "Manage connection", exact: true });
    await manage.getByLabel("Action", { exact: true }).selectOption("enable-writes");
    await manage.getByLabel("Current authenticator code", { exact: true }).fill(usedCode);
    await manage.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The authenticator code is invalid or already used. Wait for a new code.",
    );
    await manage.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await manage.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(card.getByText("Connected · Writes enabled", { exact: true })).toBeVisible();
    const rows =
      await admin`SELECT id,revision FROM workspace_connections WHERE name='Independent HTTPS API'`;
    connection = String(rows[0]?.id);
    revision = String(rows[0]?.revision);
  });
  await check(
    "real title form changes independent SQLite, emits both audits and blocks duplicate submit",
    async () => {
      await card.getByRole("button", { name: "Read articles", exact: true }).click();
      const edit = page.getByRole("form", { name: "Edit article", exact: true });
      await expect(edit).toBeVisible();
      await edit.getByLabel("Title", { exact: true }).fill("Production browser HTTPS title");
      await edit.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
      const response = page.waitForResponse(
        (r) => r.url().endsWith("/api/general/article") && r.request().method() === "POST",
      );
      await edit
        .getByRole("button", { name: "Save title or check result", exact: true })
        .evaluate((button) => {
          (button as HTMLButtonElement).click();
          (button as HTMLButtonElement).click();
        });
      const reply = await response;
      assert.equal(reply.status(), 200);
      assert.deepEqual(await reply.json(), { ok: true, version: 2 });
      first = reply.request().postDataJSON();
      await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toBeVisible();
      assert.equal(remote.inspect().article?.title, "Production browser HTTPS title");
      assert.equal(remote.inspect().article?.version, 2);
      assert.equal(remote.inspect().operations.length, 1);
      assert.equal(remote.inspect().audit.length, 1);
      assert.equal(remote.patchRequests, 1);
      const audit =
        await admin`SELECT action FROM audit_events WHERE workspace_id=${workspace} AND action LIKE 'connection.write.%' ORDER BY created_at,id`;
      assert.deepEqual(audit.map((r) => r.action).sort(), [
        "connection.write.completed",
        "connection.write.dispatched",
        "connection.write.intent",
      ]);
    },
  );
  await check("real panel API preserves idempotency and rejects changed and stale writes", async () => {
    const replay = await post(first);
    assert.equal(replay.status(), 200);
    assert.equal((await replay.json()).version, 2);
    assert.equal(remote.patchRequests, 1);
    assert.equal((await post({ ...first, title: "Changed payload" })).status(), 409);
    const stale = await post({ ...first, idempotencyKey: randomUUID(), code: await freshCode() });
    assert.equal(stale.status(), 409);
    assert.equal(remote.inspect().operations.length, 1);
  });
  await check("stale and forged article form requests show errors and preserve the draft", async () => {
    const edit = page.getByRole("form", { name: "Edit article", exact: true });
    await edit.getByLabel("Title", { exact: true }).fill("Draft after conflict");
    await edit.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await page.route("**/api/general/article", (route) =>
      route.continue({
        postData: JSON.stringify({
          ...route.request().postDataJSON(),
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
        }),
      }),
    );
    await edit.getByRole("button").click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The data changed. Reload and review before trying again.",
    );
    await expect(edit.getByLabel("Title", { exact: true })).toHaveValue("Draft after conflict");
    await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toHaveCount(0);
    await page.unrouteAll({ behavior: "wait" });
    await edit.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    await page.route("**/api/general/article", (route) =>
      route.continue({ postData: JSON.stringify({ ...route.request().postDataJSON(), id: randomUUID() }) }),
    );
    await edit.getByRole("button").click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "This connection is unavailable or disabled.",
    );
    await page.unrouteAll({ behavior: "wait" });
  });
  await check("unknown UI write retains a safe GET reconciliation without a second PATCH", async () => {
    const edit = page.getByRole("form", { name: "Edit article", exact: true });
    await edit.getByLabel("Title", { exact: true }).fill("Reconciled browser HTTPS title");
    await edit.getByLabel("Current authenticator code", { exact: true }).fill(await freshCode());
    remote.loseNextReply();
    await edit.getByRole("button", { name: "Save title or check result", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The result is uncertain. Retry the same request to check its result.",
    );
    await expect(edit.getByLabel("Title", { exact: true })).toHaveValue("Reconciled browser HTTPS title");
    await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toHaveCount(0);
    const count = remote.patchRequests;
    await page.getByRole("button", { name: "Check result", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toBeVisible();
    assert.equal(remote.patchRequests, count);
    assert.equal(remote.inspect().article?.version, 3);
    assert.equal(remote.inspect().article?.title, "Reconciled browser HTTPS title");
    assert.equal(remote.inspect().operations.length, 2);
    assert.equal(remote.inspect().audit.length, 2);
  });
  await check("stopped content process is an accessible UI error without a success message", async () => {
    await remote.stopService();
    await card.getByRole("button", { name: "Read articles", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The connected application could not be reached.",
    );
    await expect(page.getByRole("status").filter({ hasText: "Changes saved." })).toHaveCount(0);
  });
  assert.ok(connection && revision);
}
