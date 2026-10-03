const { test, expect } = require("@playwright/test");
const {
  TEST_USER,
  jsonResponse,
  loginUserBody,
  preparePage,
  waitForApp,
  emailInput,
  passwordInput,
} = require("./helpers.cjs");

test.describe("Authentication flows on active surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page);
  });

  test("logs in and reaches the current Home surface", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      const payload = JSON.parse(route.request().postData() ?? "{}");
      expect(payload).toMatchObject({ email: TEST_USER.email, password: TEST_USER.password });
      await route.fulfill(jsonResponse(loginUserBody(TEST_USER)));
    });

    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(TEST_USER.email);
    await passwordInput(page).fill(TEST_USER.password);

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("/api/v1/auth/login") && response.request().method() === "POST",
      ),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);

    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();
  });

  test("conceals invalid credentials behind the 2FA verification surface", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill(
        jsonResponse({
          requires2FA: true,
          pendingSessionId: "00000000-0000-4000-8000-000000000999",
        }),
      );
    });

    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(TEST_USER.email);
    await passwordInput(page).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/login\/verify-2fa/);
    await expect(page.getByText(/invalid email or password/i)).toHaveCount(0);
    await expect(page.getByText(/locked/i)).toHaveCount(0);
  });

  test("logs out through the active app header", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill(jsonResponse(loginUserBody(TEST_USER)));
    });
    await page.route("**/api/v1/auth/logout", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(TEST_USER.email);
    await passwordInput(page).fill(TEST_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => url.pathname === "/");

    const logoutResponse = page.waitForResponse((response) =>
      response.url().includes("/api/v1/auth/logout"),
    );
    await page.getByRole("button", { name: /sign out|navigation\.signOut/i }).click();
    await logoutResponse;
    await expect(page).toHaveURL(/\/login$/);
  });
});
