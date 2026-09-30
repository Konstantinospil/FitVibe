import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Feed Page Visual Tests", () => {
  test("feed", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/feed", { viewports: ["md", "lg"] });
    await capturePageScreenshot(page, testInfo, "feed", { waitFor: "text=Maya Rivers" });
  });
});
