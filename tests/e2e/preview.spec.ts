import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("workspace switch clears application data and owner-only controls", async ({ page }) => {
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: "Her şey bir arada." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Uygulama bağla", exact: true })).toBeVisible();
  await page.getByLabel("Çalışma alanı", { exact: true }).selectOption("ada");
  await expect(page.getByText("Tasarım Günlüğü", { exact: true })).toBeVisible();
  await expect(page.getByText("İçerik Stüdyosu", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Uygulama bağla", exact: true })).toHaveCount(0);
});

test("application search, empty state and dialog work with keyboard", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "Uygulamalar", exact: false }).first().click();
  await page.getByRole("textbox", { name: "Uygulamalarda ara" }).fill("bulunamayan");
  await expect(page.getByRole("heading", { name: "Uygulama bulunamadı" })).toBeVisible();
  await page.getByRole("button", { name: "Aramayı temizle" }).click();
  await page.getByRole("button", { name: "İçerik Stüdyosu ayrıntıları" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("sample edit is explicitly local and never posts to an application", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url());
  });
  await page.goto("/preview");
  await page.getByRole("button", { name: "İçerik Stüdyosu ayrıntıları" }).click();
  await page.getByLabel("Örnek içerik başlığı").fill("Deneme başlığı");
  await page.getByRole("button", { name: "Örnek başlığı güncelle" }).click();
  await expect(page.getByRole("status")).toContainText("Harici servise istek gönderilmedi");
  expect(writes).toEqual([]);
});

test("theme persists and core screens have no WCAG AA violations", async ({ page }) => {
  await page.goto("/preview");
  const light = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(light.violations).toEqual([]);
  await page.getByRole("button", { name: "Koyu temaya geç" }).click();
  await page.reload();
  await expect(page.locator(".panel")).toHaveAttribute("data-theme", "dark");
  const dark = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(dark.violations).toEqual([]);
});

test("mobile navigation has no page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("button", { name: "Ekip üyeleri" }).click();
  await expect(page.getByRole("heading", { name: "Ekip üyeleri" })).toBeVisible();
  await expect(page.getByText("deniz@example.test")).toBeVisible();
});

test("public health does not disclose infrastructure or credentials", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", service: "openhubpanel-web" });
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const management = await request.get("/api/v1");
  expect(management.status()).toBe(503);
});
