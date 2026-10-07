const { test, expect } = require("@playwright/test");
const {
  TEST_USER,
  preparePage,
  trackRequests,
  waitForApp,
  emailInput,
  passwordInput,
} = require("./server-helpers.cjs");

test.describe("Authentication flows on active surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page);
  });

  test("logs in through the real server and reaches Home", async ({ page }) => {
    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(TEST_USER.email);
    await passwordInput(page).fill(TEST_USER.password);

    const csrfRequests = trackRequests(
      page,
      (request) =>
        request.url().includes("/api/v1/csrf-token") && request.method() === "GET",
    );
    const loginRequests = trackRequests(
      page,
      (request) =>
        request.url().includes("/api/v1/auth/login") && request.method() === "POST",
    );

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody).toMatchObject({ requires2FA: false });
    expect(csrfRequests.requests).toHaveLength(1);
    expect(loginRequests.requests).toHaveLength(1);
    csrfRequests.stop();
    loginRequests.stop();

    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("heading", { name: /^home$/i })).toBeVisible();

    const meResponse = await page.context().request.get(
      `${new URL(page.url()).origin}/api/v1/users/me`,
    );
    expect(meResponse.status()).toBe(200);
  });

  test("conceals invalid credentials behind the real opaque 2FA challenge", async ({ page }) => {
    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill("missing-e2e-user@fitvibe.test");
    await passwordInput(page).fill("wrongpassword");

    const loginRequests = trackRequests(
      page,
      (request) =>
        request.url().includes("/api/v1/auth/login") && request.method() === "POST",
    );

    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/auth/login") &&
          response.request().method() === "POST",
      ),
      page.getByRole("button", { name: /sign in/i }).click(),
    ]);

    expect(loginResponse.status()).toBe(200);
    const challengeBody = await loginResponse.json();
    expect(challengeBody).toMatchObject({
      requires2FA: true,
      pendingSessionId: expect.any(String),
    });
    expect(loginRequests.requests).toHaveLength(1);
    loginRequests.stop();

    await expect(page).toHaveURL(/\/login\/verify-2fa/);
    await expect(page.getByText(/invalid email or password/i)).toHaveCount(0);
    await expect(page.getByText(/locked/i)).toHaveCount(0);
  });

  test("logs out through the real server and invalidates the session", async ({ page }) => {
    await page.goto("/login");
    await waitForApp(page);
    await emailInput(page).fill(TEST_USER.email);
    await passwordInput(page).fill(TEST_USER.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => url.pathname === "/");

    const logoutRequests = trackRequests(
      page,
      (request) =>
        request.url().includes("/api/v1/auth/logout") && request.method() === "POST",
    );
    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/logout") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: /sign out|navigation\.signOut/i }).click();
    const logoutResponse = await logoutResponsePromise;

    expect(logoutResponse.status()).toBe(204);
    expect(logoutRequests.requests).toHaveLength(1);
    logoutRequests.stop();
    await expect(page).toHaveURL(/\/login$/);

    const meResponse = await page.context().request.get(
      `${new URL(page.url()).origin}/api/v1/users/me`,
    );
    expect(meResponse.status()).toBe(401);
  });
});
