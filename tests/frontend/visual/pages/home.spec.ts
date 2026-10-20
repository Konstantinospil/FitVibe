import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openAuthenticatedPage } from "../helpers/capture.js";

test.describe("Home Page Visual Tests", () => {
  test("home", async ({ page }, testInfo) => {
    await openAuthenticatedPage(page, testInfo, "/", {
      viewports: ["xs", "sm", "md", "lg"],
    });
    const shell = page.locator('[data-component="page-shell"]');
    const header = shell.locator("header").first();
    const main = shell.locator('[data-slot="page-shell-main"]');
    const footer = shell.locator('[data-component="page-shell-footer"]');
    const track = main.locator(".custom-scrollbar__track");
    if (await track.isVisible()) {
      const [headerBox, mainBox, footerBox, trackBox] = await Promise.all(
        [header, main, footer, track].map((element) => element.boundingBox()),
      );
      expect(headerBox && mainBox && footerBox && trackBox).toBeTruthy();
      if (headerBox && mainBox && footerBox && trackBox) {
        expect(trackBox.y).toBeGreaterThan(headerBox.y + headerBox.height);
        expect(Math.abs(trackBox.y + trackBox.height - footerBox.y)).toBeLessThanOrEqual(2);
      }
    }
    await capturePageScreenshot(page, testInfo, "home", { waitFor: "main h1" });
  });
});
