import { test } from "@playwright/test";
import { openAuthenticatedPage, openPublicPage, waitForAppReady } from "../helpers/capture.js";
import { assertStandardScrollbars } from "../helpers/scrollbarAudit.js";

/**
 * Audit routes independently of screenshot baselines.
 * A passing screenshot must not conceal a native/legacy scrolling container.
 * The shared audit also runs in capturePageScreenshot for all other visual tests.
 */
test.describe("Legacy scrollbar detection", () => {
  for (const [name, path] of [
    ["login", "/login"],
    ["registration", "/register"],
    ["forgot password", "/forgot-password"],
  ] as const) {
    test(name, async ({ page }, info) => {
      await openPublicPage(page, info, path, { viewports: ["xs", "sm", "md", "lg"] });
      await waitForAppReady(page);
      await assertStandardScrollbars(page);
    });
  }

  for (const [name, path] of [
    ["home", "/"],
    ["calendar", "/calendar"],
    ["library", "/library"],
    ["dashboard", "/dashboard"],
    ["settings", "/settings"],
  ] as const) {
    test(name, async ({ page }, info) => {
      await openAuthenticatedPage(page, info, path, { viewports: ["xs", "sm", "md", "lg"] });
      await waitForAppReady(page);
      await assertStandardScrollbars(page);
    });
  }
});
