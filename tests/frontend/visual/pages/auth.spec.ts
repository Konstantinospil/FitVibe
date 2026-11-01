import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const resetTranslations = JSON.parse(
  readFileSync(new URL("../../../../apps/frontend/src/i18n/locales/en/common.json", import.meta.url), "utf8"),
) as { resetPassword: { title: string } };
import { skipUnlessMatrix } from "../helpers/project.js";
import { capturePageScreenshot, openPublicPage, prepareVisualPage, waitForAppReady } from "../helpers/capture.js";

test.describe("Auth Page Visual Tests", () => {
  test("login page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/login", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "login", { waitFor: '[data-component="form-stack"]' });
  });

  test("forgot password", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/forgot-password", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "forgot-password", { waitFor: '[data-component="form-stack"]' });
  });

  test("reset password", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/reset-password?token=visual-fixture", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);

    // Test ownership: #557.
    // Ensure asynchronous i18n has resolved before capturing a baseline.
    await expect(page.getByRole("heading", {
      name: resetTranslations.resetPassword.title,
      exact: true,
    })).toBeVisible();

    // Verify that the password requirements are translated and rendered.
    await expect(
      page.locator('[data-component="password-requirements-panel"]')
    ).toContainText("Password Requirements:");

    await capturePageScreenshot(page, testInfo, "reset-password", {
      waitFor: '[data-component="form-stack"]',
    });
  });

  // #557: capture the live strength indicator separately from the empty form.
  for (const flow of [
    { name: "reset", url: "/reset-password?token=visual-fixture" },
    { name: "register", url: "/register" },
  ] as const) {
    test(`${flow.name} password strength states`, async ({ page }, testInfo) => {
      await openPublicPage(page, testInfo, flow.url, {
        themes: ["light", "dark"],
        viewports: ["sm", "lg"],
      });
      await assertVerticalAuthShell(page);
      const input = page.locator('input[name="password"]');
      const meter = page.getByRole("meter", { name: "Password strength estimate" });
      await expect(input).toBeVisible();
      await expect(meter).toHaveCount(0);

      await input.fill("password");
      await expect(meter).toHaveAttribute("aria-valuetext", "Very weak");
      await capturePageScreenshot(page, testInfo, `${flow.name}-password-strength-weak`, {
        locator: page.locator('[data-component="password-strength"]'),
      });

      // Fixed synthetic fixture; score is deterministic with pinned dictionaries.
      await input.fill("r9Q!5xmV@p7L#2tZ$4wN&6cR8yK");
      await expect(meter).toHaveAttribute("aria-valuetext", "Strong");
      await capturePageScreenshot(page, testInfo, `${flow.name}-password-strength-strong`, {
        locator: page.locator('[data-component="password-strength"]'),
      });
    });
  }

  test("2FA challenge", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/login", { viewports: ["xs", "sm", "md", "lg"] });
    await waitForAppReady(page);
    await page.locator('input[name="email"]').waitFor({ state: "visible" });
    await page.route("**/api/v1/auth/login", async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ requires2FA: true, pendingSessionId: "visual-pending-session" }),
      });
    });
    await page.locator('input[name="email"]').fill("visual@example.com");
    await page.locator('input[name="password"]').fill("Visual-only-password");
    await expect(page.locator('input[name="email"]')).toHaveValue("visual@example.com");
    await expect(page.locator('input[name="password"]')).toHaveValue("Visual-only-password");
    const loginResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/auth/login" &&
        response.request().method() === "POST",
    );
    await page.locator('button[type="submit"]').click();
    const response = await loginResponse;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      requires2FA: true,
      pendingSessionId: "visual-pending-session",
    });
    await expect(page).toHaveURL(/\/login\/verify-2fa$/);
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "two-factor-challenge", { waitFor: '[data-component="form-stack"]' });
    await expect(page.locator('input[name="code"]')).toBeVisible();
  });

  test("first-visit login with cookie consent popup", async ({ page }, testInfo) => {
    skipUnlessMatrix(testInfo, { themes: ["light", "dark"], viewports: ["sm"] });
    await prepareVisualPage(page, testInfo);
    // Override only the consent status from the default deterministic visual API.
    // A first-visit browser must receive no persisted consent.
    await page.route("**/api/v1/consent/cookie-status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { hasConsent: false } }),
      });
    });
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await waitForAppReady(page);
    await expect(page.getByRole("dialog", { name: /cookie/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reject all/i })).toBeVisible();
    await capturePageScreenshot(page, testInfo, "first-visit-login-cookie-popup", { waitFor: '[role="dialog"]' });
  });

  test("register page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/register", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "register", { waitFor: '[data-component="form-stack"]' });
  });
});

async function assertVerticalAuthShell(page: import("@playwright/test").Page) {
  await waitForAppReady(page);
  const shell = page.locator('[data-component="page-shell"]');
  const header = shell.locator("header").first();
  const main = shell.locator('[data-slot="page-shell-main"]');
  // Test ownership: #558. The footer starts collapsed by design; its toggle remains visible.
  const footer = shell.locator('[data-component="page-shell-footer"]');
  const toggle = footer.locator('[data-slot="footer-toggle"]');
  await expect(header).toBeVisible();
  await expect(main).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(footer).toHaveAttribute("data-collapsed", "true");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(footer.locator('[data-slot="footer-collapsible"]')).toBeHidden();
  const boxes = await Promise.all([header, main, footer].map((item) => item.boundingBox()));
  const [top, center, bottom] = boxes;
  expect(top && center && bottom).toBeTruthy();
  if (top && center && bottom) {
    expect(top.y + top.height).toBeLessThanOrEqual(center.y + 2);
    expect(center.y + center.height).toBeLessThanOrEqual(bottom.y + 2);
  }
}
