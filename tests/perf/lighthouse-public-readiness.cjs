"use strict";

// Readiness is verified in the real browser, not inferred from a Lighthouse
// score, URL match, successful API request, or screenshot thumbnail.
// Selectors refer to existing FitVibe page and UI primitives.
const publicContent = Object.freeze({
  "/": { landmark: '[data-component="page-intro"] h1', fields: ['form input[name="email"]', 'form input[name="password"]', 'form button[type="submit"]'] },
  "/login": { landmark: '[data-component="page-intro"] h1', fields: ['form input[name="email"]', 'form input[name="password"]', 'form button[type="submit"]'] },
  "/register": { landmark: '[data-component="page-intro"] h1', fields: ['form input[name="name"]', 'form input[name="email"]', 'form button[type="submit"]'] },
  "/forgot-password": { landmark: '[data-component="page-intro"] h1', fields: ['form input[name="email"]', 'form button[type="submit"]'] },
  "/terms": { landmark: '[data-component="legal-document-shell"] h1', content: '[data-component="legal-document-shell"] .section-text' },
  "/privacy": { landmark: '[data-component="legal-document-shell"] h1', content: '[data-component="legal-document-shell"] .section-text' },
  "/cookie": { landmark: '[data-component="legal-document-shell"] h1', content: '[data-component="legal-document-shell"] .section-text', fields: ['.cookie-preferences-inline [role="region"]'] },
  "/contact": { landmark: '[data-component="page-intro"] h1', fields: ['form input[name="email"]', 'form input[name="topic"]', 'form textarea[name="message"]', 'form button[type="submit"]'] },
});

const consentBannerRoutes = new Set(["/", "/login", "/register", "/forgot-password", "/contact"]);

async function verifyPublicContent(page, pathname, consentScenario) {
  const spec = publicContent[pathname];
  if (!spec) throw new Error("Missing public page readiness contract for " + pathname);
  if (!["first-visit", "consented"].includes(consentScenario)) {
    throw new Error("Invalid consent scenario: " + consentScenario);
  }
  await page.locator('[data-component="page-shell"] main[data-slot="page-shell-main"]')
    .waitFor({ state: "visible", timeout: 30000 });
  await page.locator(spec.landmark).waitFor({ state: "visible", timeout: 30000 });
  if (!(await page.locator(spec.landmark).first().textContent())?.trim()) {
    throw new Error(pathname + ": empty page heading");
  }
  if (spec.content) {
    await page.locator(spec.content).first().waitFor({ state: "visible", timeout: 30000 });
    if (!(await page.locator(spec.content).first().textContent())?.trim()) {
      throw new Error(pathname + ": no published document body");
    }
  }
  for (const selector of spec.fields ?? []) {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 30000 });
  }
  // A static login shell, streamed Suspense fallback, loading legal document
  // or visible error can otherwise produce a deceptively valid Lighthouse LCP.
  for (const selector of [
    "#login-shell:visible",
    '[data-ssr-loading-fallback="true"]:visible',
    '[data-component="legal-document-shell"] [role="status"]:visible',
    '[role="alert"]:visible',
  ]) {
    if (await page.locator(selector).count()) {
      throw new Error(pathname + ": fallback or visible error remains: " + selector);
    }
  }
  const banner = page.locator(".cookie-consent-backdrop");
  if (consentScenario === "first-visit" && consentBannerRoutes.has(pathname)) {
    await banner.waitFor({ state: "visible", timeout: 30000 });
    await page.locator('.cookie-consent-backdrop [role="dialog"]')
      .waitFor({ state: "visible", timeout: 30000 });
  } else {
    await banner.waitFor({ state: "hidden", timeout: 30000 });
  }
}

module.exports = { publicContent, verifyPublicContent, consentBannerRoutes };
