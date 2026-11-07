const { test, expect } = require("./fixtures.cjs");
const { preparePage, waitForApp, getAccountLanguage, setAccountLanguage } = require("./server-helpers.cjs");
const { LOCALES, messages, analyzeSnapshot, capturePage } = require("../../../tests/qa/audit-ui-runtime.cjs");
const { scanRepository } = require("../../../tests/qa/audit-ui-literals.cjs");

const english = messages("en");
const mainSourceLiterals = scanRepository().findings
  .filter((item) => item.file.startsWith("apps/frontend/") && item.classification === "ui")
  .map((item) => item.text);
const AUTHENTICATED_PAGES = ["/", "/calendar", "/library", "/dashboard", "/settings"];

async function selectLanguage(page, locale) {
  await page.addInitScript((language) => {
    window.localStorage.setItem("fitvibe:language", language);
  }, locale);
}

async function inspect(page, locale, route) {
  await page.goto(route);
  await waitForApp(page);
  // The localized runtime must explicitly select the user-provided language.
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  const snapshot = await capturePage(page);
  return analyzeSnapshot(snapshot, locale, english, messages(locale), mainSourceLiterals);
}

for (const locale of LOCALES) {
  test("runtime localization inventory: public pages [" + locale + "]", async ({ page }, testInfo) => {
    await selectLanguage(page, locale);
    const results = [];
    for (const route of ["/login", "/register"]) {
      const report = await inspect(page, locale, route);
      results.push(report);
      if (route === "/login") {
        const label = require("../../../apps/frontend/src/i18n/locales/" + locale + "/auth.json").auth.login;
        await expect(page.getByRole("button", { name: label.submit, exact: true })).toBeVisible();
      }
    }
    const totals = Object.fromEntries(["englishFallbacks","renderedSourceLiterals","unresolvedKeys"].map(k =>
      [k, results.reduce((sum, item) => sum + item.counts[k], 0)]));
    console.log("Runtime localization public " + locale + ": " + JSON.stringify(totals));
    await testInfo.attach("ui-localization-public-" + locale + ".json", {
      body: Buffer.from(JSON.stringify({ locale, scope: "public", totals, results }, null, 2)),
      contentType: "application/json"
    });
  });

  test("runtime localization inventory: authenticated pages [" + locale + "]", async ({ page, athleteAccount }, testInfo) => {
    await preparePage(page, { authenticated: true, account: athleteAccount });
    const originalLanguage = await getAccountLanguage(page);
    try {
      // ADR-031: the persisted account preference, not localStorage, is authoritative.
      if (originalLanguage !== locale) {
        await setAccountLanguage(page, locale);
      }
      await selectLanguage(page, locale);
      const results = [];
      for (const route of AUTHENTICATED_PAGES) {
        const report = await inspect(page, locale, route);
        results.push(report);
      }
      const totals = Object.fromEntries(["englishFallbacks","renderedSourceLiterals","unresolvedKeys"].map(k =>
        [k, results.reduce((sum, item) => sum + item.counts[k], 0)]));
      console.log("Runtime localization authenticated " + locale + ": " + JSON.stringify(totals));
      await testInfo.attach("ui-localization-authenticated-" + locale + ".json", {
        body: Buffer.from(JSON.stringify({ locale, scope: "authenticated", totals, results }, null, 2)),
        contentType: "application/json"
      });
    } finally {
      if (originalLanguage !== locale) {
        await setAccountLanguage(page, originalLanguage);
      }
    }
  });
}
