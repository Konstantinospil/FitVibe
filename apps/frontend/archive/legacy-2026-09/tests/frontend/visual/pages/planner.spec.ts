import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Planner Page Visual Tests", () => {
  test("planner", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/planner", { viewports: ["sm", "md", "lg"] });
    const plannedDate = page.locator('input[name="planned-date"]');
    await plannedDate.waitFor({ state: "visible" });
    await plannedDate.fill("2025-10-02");
    await capturePageScreenshot(page, testInfo, "planner", {
      waitFor: 'input[name="planned-date"]',
    });
  });
});
