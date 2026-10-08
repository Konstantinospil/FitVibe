const { test: base, expect } = require("@playwright/test");
const { watchBrowser } = require("./browser-diagnostics.cjs");

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
});
module.exports = { test, expect };
