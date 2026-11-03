const { test, expect } = require("@playwright/test");
const { capturePage, LOCALES } = require("../../../tests/qa/audit-ui-runtime.cjs");

const json = (body, status = 200) => ({
  status, headers: { "content-type": "application/json" }, body: JSON.stringify(body)
});

async function prepareAdmin(page) {
  await page.route("**/api/v1/csrf-token", route =>
    route.fulfill(json({ csrfToken: "backoffice-localization-test" })));
  await page.route("**/api/v1/users/me", route =>
    route.fulfill(json({
      id: "admin-localization-fixture",
      username: "admin",
      displayName: "Administrator",
      primaryEmail: "admin@fitvibe.test",
      role: "admin"
    })));
  await page.route("**/api/v1/translations/metadata", route =>
    route.fulfill(json({ data: { languages: LOCALES, namespaces: ["common"] } })));
  await page.route("**/api/v1/translations/namespace-updates", route =>
    route.fulfill(json({ data: [] })));
  await page.route(/\/api\/v1\/translations(?:\?.*)?$/, route =>
    route.fulfill(json({ data: [], pagination: { total: 0, limit: 500, offset: 0 } })));
}

function reportOf(snapshot, locale) {
  // Backoffice has no i18next provider; these are exposed copy candidates,
  // not 1:1 defect counts. Preserve all evidence for subsequent remediation.
  const candidates = snapshot.entries
    .filter(item => /[\p{L}]/u.test(item.text))
    .map(item => ({ selector: item.selector, kind: item.kind, text: item.text.trim() }));
  return { locale, pathname: snapshot.url, htmlLang: snapshot.htmlLang,
    browserLocale: locale, textCandidates: candidates.length, candidates };
}

for (const locale of LOCALES) {
  test.describe("Backoffice localization audit " + locale, () => {
    test.use({ locale: locale + (locale === "en" ? "-US" : locale === "de" ? "-DE" : locale === "fr" ? "-FR" : locale === "es" ? "-ES" : "-GR") });

    test("records visible strings on login", async ({ page }, testInfo) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: /fitvibe backoffice/i })).toBeVisible();
      const result = reportOf(await capturePage(page), locale);
      console.log("Backoffice runtime locale " + locale + " login: " + result.textCandidates + " visible text candidates; htmlLang=" + result.htmlLang);
      await testInfo.attach("backoffice-localization-" + locale + "-login.json", {
        body: Buffer.from(JSON.stringify(result, null, 2)), contentType: "application/json"
      });
    });

    test("records visible strings on authenticated translations", async ({ page }, testInfo) => {
      await prepareAdmin(page);
      await page.goto("/translations");
      await expect(page.getByRole("heading", { name: /^translations$/i })).toBeVisible();
      const result = reportOf(await capturePage(page), locale);
      console.log("Backoffice runtime locale " + locale + " translations: " + result.textCandidates + " visible text candidates; htmlLang=" + result.htmlLang);
      await testInfo.attach("backoffice-localization-" + locale + "-translations.json", {
        body: Buffer.from(JSON.stringify(result, null, 2)), contentType: "application/json"
      });
    });
  });
}
