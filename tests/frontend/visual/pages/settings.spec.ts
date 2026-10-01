import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe.skip("Settings Page Visual Tests", () => {
  test("settings", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/settings", { viewports: ["sm", "md"] });
    await capturePageScreenshot(page, testInfo, "settings", {
      waitFor: "text=Profile Settings",
    });
  });
});
