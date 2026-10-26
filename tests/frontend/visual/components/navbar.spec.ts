import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Navbar Component Visual Tests", () => {
  test("navbar", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/", { viewports: ["sm", "md"] });
    // Test ownership: #558. Ensure navigation colors resolve from the global palette.
    const navigation = page.locator(".app-header__nav-item");
    await expect(navigation.first()).toBeVisible();
    const resolved = await navigation.evaluateAll((elements) => {
      const root = document.documentElement;
      const reference = document.createElement("span");
      root.appendChild(reference);
      const resolveToken = (name: string) => {
        reference.style.color = `var(${name})`;
        return getComputedStyle(reference).color;
      };
      const secondary = resolveToken("--color-text-secondary");
      const accent = resolveToken("--color-accent-strong");
      reference.remove();
      return {
        secondary,
        accent,
        items: elements.map((element) => ({
          color: getComputedStyle(element).color,
          active: element.getAttribute("aria-current") === "page",
          disabled: element.getAttribute("aria-disabled") === "true",
        })),
      };
    });
    expect(resolved.items.length).toBeGreaterThan(0);
    for (const item of resolved.items) {
      expect(item.color).toBe(item.active ? resolved.accent : resolved.secondary);
    }
    await capturePageScreenshot(page, testInfo, "navbar", {
      locator: page.locator("header nav").first(),
      waitFor: "header nav",
    });
  });
});
