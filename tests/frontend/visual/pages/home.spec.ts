import { expect, test, type Page } from "@playwright/test";
import {
  capturePageScreenshot,
  openAuthenticatedPage,
} from "../helpers/capture.js";

// Test ownership: #558 (visual contracts), #565 (first-login MFA).
// Capture every meaningful combination instead of inheriting transient UI state.
type HomeVisualState = {
  invitation: "visible" | "dismissed";
  footer: "collapsed" | "expanded";
};

async function setInvitationState(page: Page, state: HomeVisualState["invitation"]) {
  await page.route("**/api/v1/auth/2fa/status", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: false,
        invitationDismissed: state === "dismissed",
        enabledAt: null,
        backupCodesRemaining: 0,
      }),
    });
  });
}

async function assertFooterState(page: Page, state: HomeVisualState["footer"]) {
  const footer = page.locator('[data-component="page-shell-footer"]');
  await expect(footer).toHaveAttribute("data-collapsed", "true");
  if (state === "expanded") {
    await footer.locator('[data-slot="footer-toggle"]').click();
  }
  await expect(footer).toHaveAttribute("data-collapsed", state === "collapsed" ? "true" : "false");
  await expect(footer.locator('[data-slot="footer-toggle"]')).toHaveAttribute(
    "aria-expanded",
    state === "expanded" ? "true" : "false",
  );
}

test.describe("Home Page Visual Tests", () => {
  const states: HomeVisualState[] = [
    { invitation: "visible", footer: "collapsed" },
    { invitation: "visible", footer: "expanded" },
    { invitation: "dismissed", footer: "collapsed" },
    { invitation: "dismissed", footer: "expanded" },
  ];

  for (const state of states) {
    test(`home — 2fa ${state.invitation} — footer ${state.footer}`, async ({ page }, testInfo) => {
      // Install the account-level 2FA state before navigating. Do not dismiss
      // a real modal just to obtain a baseline with no modal.
      await openAuthenticatedPage(page, testInfo, "/", {
        viewports: ["xs", "sm", "md", "lg"],
      });
      // Route overrides installed after navigation do not change the initial
      // response; reload so that onboarding reads the explicit state.
      await setInvitationState(page, state.invitation);
      await page.reload();
      const shell = page.locator('[data-component="page-shell"]');
      const main = shell.locator('[data-slot="page-shell-main"]');
      await expect(main.locator("h1")).toBeVisible();
      const dialog = page.getByRole("dialog", { name: /secure your account/i });
      if (state.invitation === "visible") {
        await expect(dialog).toBeVisible();
      } else {
        await expect(dialog).toHaveCount(0);
      }
      await assertFooterState(page, state.footer);

      await capturePageScreenshot(page, testInfo, `home-2fa-${state.invitation}-footer-${state.footer}`, {
        waitFor: "main h1",
      });
    });
  }
});
