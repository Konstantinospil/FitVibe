import { expect, test } from "@playwright/test";
import { prepareVisualPage, waitForAppReady } from "../helpers/capture";
import { gotoAuthenticated } from "../helpers/auth";
import { skipUnlessMatrix } from "../helpers/project";

test("first authenticated visit offers 2FA before cookie preferences", async ({ page }, testInfo) => {
  skipUnlessMatrix(testInfo, { themes: ["light"], viewports: ["sm"] });
  await prepareVisualPage(page, testInfo, { authenticated: true });
  let invitationDismissed = false;
  await page.route("**/api/v1/auth/2fa/invitation/dismiss", async (route) => {
    invitationDismissed = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dismissed: true }) });
  });
  await page.route("**/api/v1/auth/2fa/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false, invitationDismissed }) });
  });
  await page.route("**/api/v1/consent/cookie-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { hasConsent: false } }),
    });
  });

  await gotoAuthenticated(page, "/settings");
  await waitForAppReady(page);
  await expect(page.getByRole("dialog", { name: /secure your account/i })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /cookie/i })).toHaveCount(0);

  await page.getByRole("button", { name: /not now/i }).click();
  await expect(page.getByRole("dialog", { name: /secure your account/i })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /cookie/i })).toBeVisible();

  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByRole("dialog", { name: /secure your account/i })).toHaveCount(0);
});
