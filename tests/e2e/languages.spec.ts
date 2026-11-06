import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { type Locale, translate } from "../../apps/web/src/i18n/locale";

for (const locale of ["en", "tr", "de"] satisfies Locale[]) {
  test(`${locale}: translates screens and dialogs and persists after reload`, async ({ page }) => {
    const t = (key: string) => translate(locale, key);
    await page.goto("/preview");
    await page.locator(".language-selector select").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { name: t("Overview") })).toBeVisible();
    await page.getByRole("button", { name: t("Connect application"), exact: true }).click();
    await expect(page.getByLabel(t("Application name"), { exact: true })).toBeVisible();
    await page.getByLabel(t("Application name"), { exact: true }).fill("Sample project");
    await page.getByRole("button", { name: t("Finish preview") }).click();
    await expect(page.getByRole("status")).toContainText(
      t("Connection preview complete. No live API connection was created."),
    );

    for (const key of ["Applications", "Team members", "Activity log", "Security", "Settings"]) {
      await page
        .locator("nav")
        .getByRole("button", { name: t(key), exact: false })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: t(key), exact: true })).toBeVisible();
    }
    await page.reload();
    await expect(page.locator(".language-selector select")).toHaveValue(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect((await page.request.get("/preview")).headers()["content-type"]).toContain("text/html");
    const html = await (await page.request.get("/preview")).text();
    expect(html).toContain(`<html lang="${locale}"`);

    await page.goto("/missing-page");
    await expect(page.getByRole("heading", { name: t("Page not found.") })).toBeVisible();
    await page.getByRole("link", { name: t("Back to home") }).click();
    await expect(page.getByText(t("Your websites, applications, and team."))).toBeVisible();
  });
}

test("language changes preserve typed data and workspace; German fits mobile", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "Content Studio details" }).click();
  await page.getByLabel("Sample article title").fill("My own title");
  await page.keyboard.press("Escape");
  await page.locator(".language-selector select").selectOption("de");
  await page
    .getByRole("button", {
      name: translate("de", "{name} details", { name: translate("de", "Content Studio") }),
    })
    .click();
  await expect(page.locator("#sample-title")).toHaveValue("My own title");
  await page.keyboard.press("Escape");
  await page.getByLabel(translate("de", "Workspace"), { exact: true }).selectOption("ada");
  await page.locator(".language-selector select").selectOption("tr");
  await expect(page.locator("#workspace")).toHaveValue("ada");
  await expect(
    page.locator(".app-table").getByText(translate("tr", "Design Journal"), { exact: true }),
  ).toBeVisible();
  await page.locator(".language-selector select").selectOption("de");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: translate("de", "Open menu") }).click();
  await page.getByRole("button", { name: translate("de", "Team members"), exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: translate("de", "Team members") })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("uses browser preferences and survives unavailable local storage", async ({ browser }) => {
  const context = await browser.newContext({ locale: "de-DE" });
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  const page = await context.newPage();
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: translate("de", "Overview") })).toBeVisible();
  await page.locator(".language-selector select").selectOption("tr");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  await context.close();
});
