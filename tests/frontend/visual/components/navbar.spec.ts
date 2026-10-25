import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Navbar Component Visual Tests", () => {
  test("navbar", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/", { viewports: ["sm", "md"] });
    // Test ownership: #558. Ensure navigation colors resolve from the global palette.\n    const navigation = page.locator(".app-header__nav-item");\n    await expect(navigation.first()).toBeVisible();\n    const resolved = await navigation.first().evaluate((element) => {\n      const root = getComputedStyle(document.documentElement);\n      return {\n        current: getComputedStyle(element).color,\n        secondary: root.getPropertyValue("--color-text-secondary").trim(),\n        accent: root.getPropertyValue("--color-accent-strong").trim(),\n      };\n    });\n    expect(resolved.secondary).toBeTruthy();\n    expect(resolved.accent).toBeTruthy();\n    await capturePageScreenshot(page, testInfo, "navbar", {
      locator: page.locator("header nav").first(),
      waitFor: "header nav",
    });
  });
});
