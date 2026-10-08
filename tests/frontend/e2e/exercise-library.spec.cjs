const { test, expect } = require("./fixtures.cjs");
const { preparePage, waitForApp } = require("./server-helpers.cjs");

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
