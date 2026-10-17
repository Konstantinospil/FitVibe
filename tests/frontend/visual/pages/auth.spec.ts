import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openPublicPage, waitForAppReady } from "../helpers/capture.js";

test.describe("Auth Page Visual Tests", () => {
  test("login page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/login", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "login", { waitFor: '[data-component="form-stack"]' });
  });

  test("forgot password", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/forgot-password", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "forgot-password", { waitFor: '[data-component="form-stack"]' });
  });

  test("reset password", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/reset-password?token=visual-fixture", { viewports: ["xs", "sm", "md", "lg"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "reset-password", { waitFor: '[data-component="form-stack"]' });
  });

  test("register page", async ({ page }, testInfo) => {
    await openPublicPage(page, testInfo, "/register", { viewports: ["xs", "sm"] });
    await assertVerticalAuthShell(page);
    await capturePageScreenshot(page, testInfo, "register", { waitFor: '[data-component="form-stack"]' });
  });
});

async function assertVerticalAuthShell(page: import("@playwright/test").Page) {
  await waitForAppReady(page);
  const shell = page.locator('[data-component="page-shell"]');
  const header = shell.locator("header").first();
  const main = shell.locator('[data-slot="page-shell-main"]');
  const footer = shell.locator("footer").last();
  await expect(header).toBeVisible();
  await expect(main).toBeVisible();
  await expect(footer).toBeVisible();
  const boxes = await Promise.all([header, main, footer].map((item) => item.boundingBox()));
  const [top, center, bottom] = boxes;
  expect(top && center && bottom).toBeTruthy();
  if (top && center && bottom) {
    expect(top.y + top.height).toBeLessThanOrEqual(center.y + 2);
    expect(center.y + center.height).toBeLessThanOrEqual(bottom.y + 2);
  }
}
