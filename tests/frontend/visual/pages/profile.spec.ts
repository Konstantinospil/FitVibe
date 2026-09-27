import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Profile Page Visual Tests", () => {
  test("profile", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/profile", { viewports: ["sm", "md"] });
    await page.getByRole("heading", { name: "Measurements" }).waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await capturePageScreenshot(page, testInfo, "profile", { waitFor: "role=heading" });
  });
});
