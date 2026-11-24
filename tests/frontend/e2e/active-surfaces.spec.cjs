const { test, expect } = require("./fixtures.cjs");
const { preparePage, waitForApp } = require("./server-helpers.cjs");
const { navigation } = require("../../../apps/frontend/src/i18n/locales/en/common.json");

test.describe("Active application surfaces", () => {
  test.beforeEach(async ({ page, athleteAccount }) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
  });

  test("authenticated Home renders the current production shell", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
    const mainNavigation = page.getByRole("navigation", { name: navigation.main, exact: true });
    await expect(mainNavigation).toBeVisible();
    await expect(mainNavigation.getByRole("link", { name: navigation.home, exact: true })).toBeVisible();
    await expect(page.getByText(/trending workouts/i).first()).toBeVisible();
    await expect(page.getByText(/previous activities/i).first()).toBeVisible();
  });

  test("Calendar is reachable through the production navigation", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    const calendarLink = page.getByRole("link", { name: /^calendar$/i });
    await expect(calendarLink).toBeVisible();
    await calendarLink.click();

    await page.waitForURL((url) => url.pathname === "/calendar");
    await expect(page.getByRole("heading", { name: /^calendar$/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("retired application routes do not revive legacy pages", async ({ page }) => {
    for (const retiredPath of ["/exercises", "/planner", "/sessions", "/insights"]) {
      await page.goto(retiredPath);
      await waitForApp(page);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
    }
  });
});
