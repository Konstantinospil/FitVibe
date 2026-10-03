const { test, expect } = require("@playwright/test");
const { preparePage, waitForApp } = require("./helpers.cjs");

test.describe("Library surface contract", () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page, { authenticated: true });
  });

  test("current /library route renders the intentionally minimal Library surface", async ({ page }) => {
    await page.goto("/library");
    await waitForApp(page);
    await expect(page.getByRole("heading", { name: /^library$/i, level: 1 })).toBeVisible();
    await expect(page.locator("[data-app-surface='library']")).toBeVisible();
  });

  test("legacy /exercises route cannot revive the archived exercise library", async ({ page }) => {
    await page.goto("/exercises");
    await waitForApp(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  });
});
