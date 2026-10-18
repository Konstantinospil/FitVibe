const { test, expect } = require("./fixtures.cjs");
const { observeMutation } = require("./request-observer.cjs");
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
    const loginMutation = observeMutation(page, "POST", "/api/v1/auth/login");

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
    loginMutation.assertExactlyOnce(200);
    csrfRequests.stop();
    loginMutation.stop();

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

    const loginMutation = observeMutation(page, "POST", "/api/v1/auth/login");

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
    loginMutation.assertExactlyOnce(200);
    loginMutation.stop();

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

    const logoutMutation = observeMutation(page, "POST", "/api/v1/auth/logout");
    const logoutResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/logout") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: /sign out|navigation\.signOut/i }).click();
    const logoutResponse = await logoutResponsePromise;

    expect(logoutResponse.status()).toBe(204);
    logoutMutation.assertExactlyOnce(204);
    logoutMutation.stop();
    await expect(page).toHaveURL(/\/login$/);

    const meResponse = await page.context().request.get(
      `${new URL(page.url()).origin}/api/v1/users/me`,
    );
    expect(meResponse.status()).toBe(401);
  });
  test("renders legal publications from real backend without application labels", async ({ page }) => {
    await page.goto("/terms");
    await waitForApp(page);
    const response = await page.context().request.get(
      `${new URL(page.url()).origin}/api/v1/legal/documents/terms?language=en`,
    );
    expect(response.status()).toBe(200);
    const publication = await response.json();
    expect(publication).toMatchObject({
      documentType: "terms",
      language: "en",
      version: expect.any(String),
      legacyWithoutSnapshot: expect.any(Boolean),
    });
    if (publication.content === null) {
      expect(publication.legacyWithoutSnapshot).toBe(true);
    } else {
      expect(publication.content).toEqual(expect.any(Object));
      expect(Object.keys(publication.content).some((key) => /^section\\d+$|^intro$/i.test(key))).toBe(true);
    }
    const shell = page.locator('[data-component="legal-document-shell"]');
    await expect(shell).toBeVisible();
    await expect(shell.locator(".section").first()).toBeVisible();
    await expect(shell.getByText(/do not render control labels/i)).toHaveCount(0);
    await expect(shell.locator(".custom-scrollbar__viewport")).toHaveCSS("overflow-y", "auto");
  });

  test("loads production font families and keeps login chrome vertically ordered", async ({ page }) => {
    await page.goto("/login");
    await waitForApp(page);
    const shell = page.locator('[data-component="page-shell"]');
    try {
      await expect(shell).toBeVisible();
    } catch (error) {
      const state = await page.evaluate(() => ({
        pathname: window.location.pathname,
        loading: Boolean(document.querySelector("#login-shell")),
        pageShell: Boolean(document.querySelector('[data-component="page-shell"]')),
        errorBoundary: Boolean(document.querySelector('[role="alert"]')),
      }));
      console.error("Login layout rendering state:", JSON.stringify(state));
      throw error;
    }
    const geometry = await shell.evaluate((shell) => {
      const header = shell.querySelector("header");
      const main = shell.querySelector('[data-slot="page-shell-main"]');
      const footer = shell.querySelector("footer");
      if (!header || !main || !footer) return null;
      return {
        top: header.getBoundingClientRect().bottom,
        middleStart: main.getBoundingClientRect().top,
        middleEnd: main.getBoundingClientRect().bottom,
        bottom: footer.getBoundingClientRect().top,
        font: getComputedStyle(main).fontFamily,
        token: getComputedStyle(document.documentElement).getPropertyValue("--font-family-body").trim(),
        fontStatus: document.fonts.status,
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry.top).toBeLessThanOrEqual(geometry.middleStart + 2);
    expect(geometry.middleEnd).toBeLessThanOrEqual(geometry.bottom + 2);
    expect(geometry.token).toBeTruthy();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.status)).toBe("loaded");
  });

});
