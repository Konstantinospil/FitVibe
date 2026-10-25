const { test: base, expect } = require("@playwright/test");
const { watchBrowser } = require("./browser-diagnostics.cjs");
const {
  prepareFullyOnboardedPage,
  prepareFirstLoginState,
  prepareConsentRequiredPage,
} = require("./server-helpers.cjs");

const test = base.extend({
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
  fullyOnboardedPage: async ({ page }, use) => {
    await prepareFullyOnboardedPage(page);
    await use(page);
  },
  firstLoginPage: async ({ page }, use, testInfo) => {
    const account = await prepareFirstLoginState(page, testInfo);
    await use({ page, account });
  },
  consentRequiredPage: async ({ page }, use) => {
    await prepareConsentRequiredPage(page);
    await use(page);
  },
});
module.exports = { test, expect };
