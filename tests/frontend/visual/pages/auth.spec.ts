import { test } from "@playwright/test";
import { capturePageScreenshot, openPublicPage } from "../helpers/capture.js";

test.describe("Auth Page Visual Tests", () => {
  test("login page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/login", { viewports: ["xs", "sm"] });
    await capturePageScreenshot(page, testInfo, "login", { waitFor: '[data-component="form-stack"]' });
  });

  test("register page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/register", { viewports: ["xs", "sm"] });
    await capturePageScreenshot(page, testInfo, "register", { waitFor: '[data-component="form-stack"]' });
  });
});
