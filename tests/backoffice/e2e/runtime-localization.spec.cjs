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

const expectedAdminCopy = {
  en: { dashboard: "Admin Dashboard", logout: "Logout", audit: "Audit Logs", search: "Search by Request ID", empty: "No audit logs found" },
  de: { dashboard: "Administrationsübersicht", logout: "Abmelden", audit: "Audit-Protokolle", search: "Nach Anfrage-ID suchen", empty: "Keine Audit-Protokolle gefunden" },
  fr: { dashboard: "Tableau de bord administrateur", logout: "Déconnexion", audit: "Journaux d’audit", search: "Rechercher par ID de requête", empty: "Aucun journal d’audit trouvé" },
  es: { dashboard: "Panel de administración", logout: "Cerrar sesión", audit: "Registros de auditoría", search: "Buscar por ID de solicitud", empty: "No se encontraron registros de auditoría" },
  el: { dashboard: "Πίνακας διαχείρισης", logout: "Αποσύνδεση", audit: "Αρχεία καταγραφής ελέγχου", search: "Αναζήτηση με αναγνωριστικό αιτήματος", empty: "Δεν βρέθηκαν αρχεία καταγραφής ελέγχου" }
};

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

    test("renders localized Audit Logs filters and empty state", async ({ page }) => {
      await prepareAdmin(page);
      await page.route(/\/api\/v1\/logs(?:\?.*)?$/, (route) =>
        route.fulfill(json({ logs: [] })));
      await page.route("**/api/v1/admin/action-mappings", (route) =>
        route.fulfill(json({ mappings: [] })));
      await page.goto("/audit-logs");

      const copy = expectedAdminCopy[locale];
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { name: copy.audit, level: 1 })).toBeVisible();
      await expect(page.getByText(copy.search, { exact: true })).toBeVisible();
      await expect(page.getByText(copy.empty, { exact: true })).toBeVisible();
    });

    test("records visible strings on authenticated translations", async ({ page }, testInfo) => {
      await prepareAdmin(page);
      await page.goto("/translations");
      await expect(page.getByRole("heading", { name: /^translations$/i })).toBeVisible();
      // These components were audited in the first 500 findings. Assert actual
      // rendered localized UI rather than simply collecting English text.
      const copy = expectedAdminCopy[locale];
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { name: copy.dashboard, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: copy.logout, exact: true })).toBeVisible();
      await expect(page.getByText(copy.audit, { exact: true }).first()).toBeVisible();
      const result = reportOf(await capturePage(page), locale);
      console.log("Backoffice runtime locale " + locale + " translations: " + result.textCandidates + " visible text candidates; htmlLang=" + result.htmlLang);
      await testInfo.attach("backoffice-localization-" + locale + "-translations.json", {
        body: Buffer.from(JSON.stringify(result, null, 2)), contentType: "application/json"
      });
    });
  });
}
