import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Navbar Component Visual Tests", () => {
  test("navbar", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/", { viewports: ["sm", "md"] });
    // Test ownership: #558. Ensure navigation colors resolve from the global palette.\n    const navigation = page.locator(".app-header__nav-item");\n    await expect(navigation.first()).toBeVisible();\n    const resolved = await navigation.evaluateAll((elements) => {\n      const root = document.documentElement;\n      const reference = document.createElement("span");\n      root.appendChild(reference);\n      const resolveToken = (name: string) => {\n        reference.style.color = `var(${name})`;\n        return getComputedStyle(reference).color;\n      };\n      const secondary = resolveToken("--color-text-secondary");\n      const accent = resolveToken("--color-accent-strong");\n      reference.remove();\n      return {\n        secondary,\n        accent,\n        items: elements.map((element) => ({\n          color: getComputedStyle(element).color,\n          active: element.getAttribute("aria-current") === "page",\n          disabled: element.getAttribute("aria-disabled") === "true",\n        })),\n      };\n    });\n    expect(resolved.items.length).toBeGreaterThan(0);\n    for (const item of resolved.items) {\n      expect(item.color).toBe(item.active ? resolved.accent : resolved.secondary);\n    }\n    await capturePageScreenshot(page, testInfo, "navbar", {
      locator: page.locator("header nav").first(),
      waitFor: "header nav",
    });
  });
});
