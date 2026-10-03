const { test, expect } = require("@playwright/test");
const { jsonResponse, preparePage, waitForApp } = require("./helpers.cjs");

async function mockActiveSurfaceData(page) {
  await page.route("**/api/v1/feed**", async (route) => {
    await route.fulfill(jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }));
  });
  await page.route("**/api/v1/sessions**", async (route) => {
    if (route.request().url().includes("/auth/sessions")) {
      await route.fallback();
      return;
    }
    await route.fulfill(jsonResponse({ data: [], total: 0, limit: 100, offset: 0 }));
  });
}

test.describe("Active application surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page, { authenticated: true });
    await mockActiveSurfaceData(page);
  });

  test("authenticated Home renders the current production shell", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);

    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /home/i })).toBeVisible();
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
