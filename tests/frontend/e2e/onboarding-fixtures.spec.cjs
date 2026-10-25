const { test, expect } = require("./fixtures.cjs");
const {
  waitForApp,
  getFirstLoginTwoFactorDialog,
  getCookieConsentDialog,
  dismissFirstLoginTwoFactorInvitation,
  setAccountLanguage,
  localeMessages,
} = require("./server-helpers.cjs");

// Test ownership: #557. These tests verify the reusable real-server onboarding
// fixtures themselves; ordinary feature tests should consume these states rather
// than accidentally exercising first-login or cookie onboarding.
test.describe("deterministic onboarding fixture contract", () => {
  test("fully onboarded state has no onboarding overlays", async ({ fullyOnboardedPage }) => {
    const page = fullyOnboardedPage;
    await page.goto("/");
    await waitForApp(page);

    await expect(page.locator("[data-onboarding-2fa-stage]")).toHaveAttribute(
      "data-onboarding-2fa-stage",
      "done",
    );
    await expect(await getFirstLoginTwoFactorDialog(page)).toHaveCount(0);
    await expect(await getCookieConsentDialog(page)).toHaveCount(0);
  });

  test("consent-required state resolves 2FA before presenting cookie consent", async ({
    consentRequiredPage,
  }) => {
    const page = consentRequiredPage;
    await page.goto("/");
    await waitForApp(page);

    await expect(page.locator("[data-onboarding-2fa-stage]")).toHaveAttribute(
      "data-onboarding-2fa-stage",
      "done",
    );
    await expect(await getFirstLoginTwoFactorDialog(page)).toHaveCount(0);
    await expect(await getCookieConsentDialog(page)).toBeVisible();
  });

  test("first-login state localizes 2FA and only then advances to localized consent", async ({
    firstLoginPage,
  }) => {
    const { page } = firstLoginPage;
    await setAccountLanguage(page, "de");
    await page.goto("/");
    await waitForApp(page);

    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    const messages = localeMessages("de");
    const invitation = await getFirstLoginTwoFactorDialog(page);
    await expect(invitation).toBeVisible();
    await expect(invitation).toHaveAccessibleName(messages.common.firstLogin2fa.title);
    await expect(await getCookieConsentDialog(page)).toHaveCount(0);

    await dismissFirstLoginTwoFactorInvitation(page);

    await expect(page.locator("[data-onboarding-2fa-stage]")).toHaveAttribute(
      "data-onboarding-2fa-stage",
      "done",
    );
    const consent = await getCookieConsentDialog(page);
    await expect(consent).toBeVisible();
    await expect(consent).toHaveAccessibleName(messages.cookie.title);
  });
});
