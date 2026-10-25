const { test: base, expect } = require("@playwright/test");
const { watchBrowser } = require("./browser-diagnostics.cjs");
const {
  prepareFullyOnboardedPage,
  prepareFirstLoginState,
  prepareConsentRequiredPage,
  createFirstLoginAccount,
  ensureSeededOnboardingComplete,
} = require("./server-helpers.cjs");

const test = base.extend({
  // Test ownership: #557. A real independently registered athlete per test.
  // Do not use a seeded administrator to bypass mandatory MFA.
  athleteAccount: async ({ browser }, use, testInfo) => {
    const setupPage = await browser.newPage();
    try {
      const account = await createFirstLoginAccount(setupPage, testInfo);
      await ensureSeededOnboardingComplete(setupPage);
      await use(account);
    } finally {
      await setupPage.close();
    }
  },
  page: async ({ page }, use, testInfo) => {
    const diagnostics = watchBrowser(page);
    try {
      await use(page);
    } finally {
      const record = diagnostics.snapshot();
      diagnostics.stop();
      if (testInfo.status !== "passed" || Object.values(record).some((values) => values.length)) {
        await testInfo.attach("browser-diagnostics.json", {
          body: Buffer.from(JSON.stringify(record, null, 2)),
          contentType: "application/json",
        });
      }
      if (testInfo.status === "passed") {
        diagnostics.assertHealthy();
      }
    }
  },
  fullyOnboardedPage: async ({ page, athleteAccount }, use) => {
    await prepareFullyOnboardedPage(page, athleteAccount);
    await use(page);
  },
  firstLoginPage: async ({ page }, use, testInfo) => {
    const account = await prepareFirstLoginState(page, testInfo);
    await use({ page, account });
  },
  consentRequiredPage: async ({ page, athleteAccount }, use) => {
    await prepareConsentRequiredPage(page, athleteAccount);
    await use(page);
  },
});
module.exports = { test, expect };
