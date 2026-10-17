import { expect, test } from "@playwright/test";
import { capturePageScreenshot, openPublicPage, openAuthenticatedPage, waitForAppReady } from "../helpers/capture.js";

const publication = (documentType: "terms" | "privacy") => ({
  documentType,
  version: "2026-10-01.1",
  changeClass: "material",
  userAction: documentType === "terms" ? "accept" : "acknowledge",
  effectiveAt: "2026-10-01T00:00:00.000Z",
  publishedAt: "2026-10-01T00:00:00.000Z",
  language: "en",
  legacyWithoutSnapshot: false,
  content: {
    title: documentType === "terms" ? "Terms and Conditions" : "Privacy Policy",
    intro: "Authoritative publication text",
    section1: { title: "1. Scope", content: "The published terms govern this service." },
    loading: "Do not render loading translations",
    consent: { revoke: "Do not render control labels" },
  },
});

test.describe("Legal document visual and structure", () => {
  for (const documentType of ["terms", "privacy"] as const) {
    test(`${documentType} unauthenticated`, async ({ page }, testInfo) => {
      await openPublicPage(page, testInfo, `/${documentType}`, { viewports: ["xs", "sm", "md", "lg"] });
      await page.route(`**/api/v1/legal/documents/${documentType}*`, async route => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publication(documentType)) });
      });
      await page.reload();
      await waitForAppReady(page);
      const shell = page.locator('[data-component="legal-document-shell"]');
      await expect(shell.getByText("Authoritative publication text")).toBeVisible();
      await expect(shell.getByText("1. Scope")).toBeVisible();
      await expect(shell.getByText("Do not render control labels")).toHaveCount(0);
      await expect(shell.getByText("Do not render loading translations")).toHaveCount(0);
      await capturePageScreenshot(page, testInfo, `legal-${documentType}`, { waitFor: ".legal-document-shell__content .section" });
    });
    test(`${documentType} authenticated action`, async ({ page }, testInfo) => {
      await openAuthenticatedPage(page, testInfo, `/${documentType}`, { viewports: ["xs", "md"] });
      await page.route(`**/api/v1/legal/documents/${documentType}*`, async route => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publication(documentType)) });
      });
      await page.reload();
      await waitForAppReady(page);
      await expect(page.locator(".legal-document-shell__footer button")).toBeVisible();
    });
  }
});
