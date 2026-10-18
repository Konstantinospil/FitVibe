import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openPublicPage, prepareVisualPage, waitForAppReady } from "../helpers/capture.js";
import { skipUnlessMatrix } from "../helpers/project.js";

test.describe("Auth Page Visual Tests", () => {
  test("login page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/login", { viewports: ["xs", "sm"] });
    await capturePageScreenshot(page, testInfo, "login", { waitFor: '[data-component="form-stack"]' });
  });

  test("register page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/register", { viewports: ["xs", "sm"] });
    await capturePageScreenshot(page, testInfo, "register", { waitFor: '[data-component="form-stack"]' });
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
    const screenshotPath = testInfo.outputPath("first-visit-login-cookie-popup.png");
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    await testInfo.attach("first-visit-login-cookie-popup", {
      path: screenshotPath,
      contentType: "image/png",
    });
  });

});
