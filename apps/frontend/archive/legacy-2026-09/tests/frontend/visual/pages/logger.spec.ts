import { test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Logger Page Visual Tests", () => {
  test("logger", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/logger/session-123", {
      viewports: ["sm", "md"],
    });
    await capturePageScreenshot(page, testInfo, "logger", {
      waitFor: "text=Leg Day Circuit",
    });
  });
});
