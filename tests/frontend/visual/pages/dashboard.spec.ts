import { test, expect } from "@playwright/test";
import {
  capturePageScreenshot,
  openAuthenticatedPage,
  openPublicPage,
} from "../helpers/capture.js";

test.describe("Dashboard Page Visual Tests", () => {
  test.describe("Unauthenticated State", () => {
    test("dashboard redirect", async ({ page }, testInfo) => {
      await openPublicPage(page, testInfo, "/dashboard", { themes: ["light"], viewports: ["xs"] });
      await expect(page).toHaveURL(/\/login/);
      await capturePageScreenshot(page, testInfo, "dashboard-redirect", {
        waitFor: '[data-component="form-stack"]',
      });
    });
  });

  test.describe("Authenticated State", () => {
    test("dashboard", async ({ page }, testInfo) => {
      await openAuthenticatedPage(page, testInfo, "/", {
        viewports: ["xs", "sm", "md", "lg"],
      });
      await capturePageScreenshot(page, testInfo, "dashboard", { waitFor: "main h1" });
    });
  });
});
