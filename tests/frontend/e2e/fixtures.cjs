const { test: base, expect } = require("@playwright/test");
const { watchBrowser } = require("./browser-diagnostics.cjs");
const {
  prepareFullyOnboardedPage,
  prepareFirstLoginState,
  prepareConsentRequiredPage,
  createFirstLoginAccount,
  ensureSeededOnboardingComplete,
  ensureEssentialCookieConsent,
} = require("./server-helpers.cjs");

const test = base.extend({
  // Test ownership: #557. A registered athlete per Playwright worker.
  // Reuse only its verified session cookies in test-isolated browser contexts.
  // Explicit registration, 2FA, logout, and revocation tests use separate flows.
  athleteAccount: [async ({ browser }, use, workerInfo) => {
    const setupPage = await browser.newPage();
    try {
      const account = await createFirstLoginAccount(setupPage, {
        testId: `worker-athlete-${workerInfo.parallelIndex}`,
        retry: workerInfo.workerIndex,
        repeatEachIndex: 0,
      });
      await ensureSeededOnboardingComplete(setupPage);
      await ensureEssentialCookieConsent(setupPage);
      const sessionCookies = await setupPage.context().cookies();
      await use({ ...account, sessionCookies });
    } finally {
      await setupPage.close();
    }
  }, { scope: "worker" }],
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
