import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Home Page Visual Tests", () => {
  test("home", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/", {
      viewports: ["xs", "sm", "md", "lg"],
    });
    await capturePageScreenshot(page, testInfo, "home", { waitFor: "main h1" });
  });
});
