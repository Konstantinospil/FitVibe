const { test, expect } = require("@playwright/test");
const {
  SEEDED_USER,
  prepareRealPage,
  waitForApp,
  emailInput,
  passwordInput,
} = require("./helpers.cjs");

test.describe("Library surface contract", () => {
  test.beforeEach(async ({ page }) => {
    await prepareRealPage(page);
    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(SEEDED_USER.email);
    await passwordInput(page).fill(SEEDED_USER.password);
    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    expect((await loginResponse).ok()).toBeTruthy();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
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
