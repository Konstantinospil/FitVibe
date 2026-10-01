import { test, expect } from "@playwright/test";
import {
  capturePageScreenshot,
  openAuthenticatedPage,
  openPublicPage,
} from "../helpers/capture.js";

test.describe("Home Page Visual Tests", () => {
  test.describe("Unauthenticated State", () => {
    test("home redirect", async ({ page }, testInfo) => {
      await openPublicPage(page, testInfo, "/", { themes: ["light"], viewports: ["xs"] });
      await expect(page).toHaveURL(/\/login/);
      await capturePageScreenshot(page, testInfo, "home-redirect", {
        waitFor: '[data-component="form-stack"]',
      });
    });
  });

  test.describe("Authenticated State", () => {
    test("home", async ({ page }, testInfo) => {
      await openAuthenticatedPage(page, testInfo, "/", {
        viewports: ["xs", "sm", "md", "lg"],
      });
      await capturePageScreenshot(page, testInfo, "home", { waitFor: "main h1" });
    });
  });
});
