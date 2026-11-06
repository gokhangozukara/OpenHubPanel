import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("workspace search opens applications with the keyboard and stays scoped", async ({ page }) => {
  await page.goto("/preview");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search workspace" });
  await expect(search.getByRole("textbox")).toBeFocused();
  await search.getByRole("textbox").fill("Support");
  await page.keyboard.press("ArrowDown");
  await expect(search.getByRole("button", { name: "Support Desk" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Support Desk" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Workspace", { exact: true }).selectOption("ada");
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  await search.getByRole("textbox").fill("Content Studio");
  await expect(search.getByRole("status")).toHaveText("No matching results");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Search workspace", exact: true })).toBeFocused();
});

test("sidebar can collapse, remembers its state, and retains accessible navigation", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".panel")).toHaveAttribute("data-sidebar", "collapsed");
  await page.reload();
  await expect(page.locator(".panel")).toHaveAttribute("data-sidebar", "collapsed");
  await page.locator("nav").getByRole("button", { name: "Team members", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Team members", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByLabel("Workspace", { exact: true })).toBeVisible();
});

test("application filters combine with search and clear together", async ({ page }) => {
  await page.goto("/preview");
  await page.locator("nav").getByRole("button", { name: "Applications", exact: true }).click();
  await page.getByLabel("Filter by connection").selectOption("pending");
  await expect(page.locator(".app-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".app-table")).toContainText("Portfolio");
  await page.getByRole("textbox", { name: "Search applications" }).fill("Support");
  await expect(page.getByRole("heading", { name: "No applications found" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByLabel("Filter by connection")).toHaveValue("all");
  await expect(page.locator(".app-table tbody tr")).toHaveCount(3);
});

test("mobile search and desktop collapsed navigation pass accessibility checks", async ({ page }) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations,
  ).toEqual([]);
});
