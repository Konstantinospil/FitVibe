#!/usr/bin/env node
"use strict";

// Investigation-only public audit: use the existing isolated E2E production
// ingress and real backend. The established blocking Lighthouse gate is not
// replaced by this diagnostic collection.
const fs = require("node:fs");
const path = require("node:path");
const { launchLighthouseChrome } = require("./lighthouse-chrome-runtime.cjs");
const { observeNavigation } = require("./lighthouse-observe-navigation.cjs");
const { validateMeasurement, assertScenarioCoverage } = require("./lighthouse-measurement-validity.cjs");
const { assertPublicWorstBudgets } = require("./lighthouse-public-budgets.cjs");
const { publicRoutes } = require("./lighthouse-routes.cjs");
const { verifyPublicContent } = require("./lighthouse-public-readiness.cjs");
const { validateMeasurement } = require("./lighthouse-measurement-validity.cjs");
const { writePerformanceReport } = require("./lighthouse-performance-report.cjs");

const outputDir = path.resolve(__dirname, "lhci-output/public-real");
const canonical = JSON.parse(
  fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"),
);

const REQUIRED_API_PATHS = Object.freeze({
  "/": ["/api/v1/consent/cookie-status"],
  "/login": ["/api/v1/consent/cookie-status"],
  "/register": ["/api/v1/auth/register/options"],
  "/forgot-password": ["/api/v1/consent/cookie-status"],
  "/terms": ["/api/v1/legal/documents/terms"],
  "/privacy": ["/api/v1/legal/documents/privacy"],
  "/cookie": ["/api/v1/legal/documents/cookie"],
  "/contact": ["/api/v1/csrf-token"],
});

function publicConfigForOrigin(origin) {
  const base = new URL(origin);
  if (base.hostname !== "127.0.0.1" || base.protocol !== "http:") {
    throw new Error("Real-backend Lighthouse requires an isolated loopback HTTP ingress");
  }
  const source = canonical.ci.collect.url.map((value) => new URL(value).pathname).sort();
  if (JSON.stringify(source) !== JSON.stringify([...publicRoutes].sort())) {
    throw new Error("Canonical Lighthouse route inventory has drifted");
  }
  if (!Number.isInteger(canonical.ci.collect.numberOfRuns) ||
      canonical.ci.collect.numberOfRuns < 3) {
    throw new Error("Real-backend Lighthouse requires at least three runs");
  }
  return {
    ...canonical,
    ci: {
      ...canonical.ci,
      collect: {
        ...canonical.ci.collect,
        url: publicRoutes.map((pathname) => new URL(pathname, base).toString()),
      },
    },
  };
}

function assessPublicReport(report, pathname, origin) {
  const errors = [];
  const expected = new URL(pathname, origin).toString();
  const actual = report.finalDisplayedUrl || report.finalUrl;
  if (report.requestedUrl !== expected) {
    errors.push("wrong requested URL: " + report.requestedUrl);
  }
  if (!actual || new URL(actual).origin !== new URL(expected).origin ||
      new URL(actual).pathname !== pathname) {
    errors.push("redirected or replaced by " + String(actual));
  }
  if (report.runtimeError) errors.push("Lighthouse runtime error: " + report.runtimeError.message);
  for (const name of ["performance", "accessibility", "best-practices", "seo"]) {
    if (typeof report.categories?.[name]?.score !== "number") {
      errors.push("missing " + name + " score");
    }
  }

  const network = report.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(network)) {
    errors.push("missing network request evidence");
  }
  const api = Array.isArray(network) ? network.filter((item) => {
    try {
      const url = new URL(item.url);
      return url.origin === new URL(origin).origin && url.pathname.startsWith("/api/v1/");
    } catch {
      return false;
    }
  }) : [];
  for (const item of api) {
    if (typeof item.statusCode !== "number" || item.statusCode < 200 ||
        item.statusCode >= 400) {
      errors.push("backend " + String(item.statusCode) + " on " + new URL(item.url).pathname);
    }
  }
  for (const required of REQUIRED_API_PATHS[pathname] ?? []) {
    if (!api.some((item) => new URL(item.url).pathname === required &&
                    item.statusCode >= 200 && item.statusCode < 400)) {
      errors.push("missing successful backend response for " + required);
    }
  }
  const node = report.audits?.["lcp-breakdown-insight"]?.details?.items?.find(
    (item) => item.type === "node",
  );
  const lcpElement = node?.nodeLabel ?? null;
  if (["/terms", "/privacy", "/cookie"].includes(pathname) &&
      (lcpElement === "Error" || lcpElement === "common.error")) {
    errors.push("LCP measures legal-document error instead of content");
  }
  return { errors, lcpElement, apiRequests: api.length };
}


/**
 * Real browser preflight checks all public routes twice: fresh anonymous browser
 * identity, then the same identity after consent is saved by the real UI/API.
 * This does not substitute for three Lighthouse runs in each scenario.
 */
async function verifyBrowserContentAndConsent(origin) {
  const { chromium } = require("@playwright/test");
  const browser = await chromium.launch({ headless: true });
  const observations = [];
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  try {
    const statusUrl = new URL("/api/v1/consent/cookie-status", origin).toString();
    const firstStatus = await context.request.get(statusUrl);
    if (!firstStatus.ok() || (await firstStatus.json()).data?.hasConsent) {
      throw new Error("First-visit browser identity already has persisted consent");
    }

    const navigateAndVerify = async (pathname, scenario) => {
      try {
        await page.goto(new URL(pathname, origin).toString(), { waitUntil: "domcontentloaded" });
        await verifyPublicContent(page, pathname, scenario);
        const final = new URL(page.url());
        if (final.origin !== origin || final.pathname !== pathname) {
          throw new Error(pathname + ": content preflight redirected to " + page.url());
        }
        observations.push({ path: pathname, scenario, ready: true });
      } catch (error) {
        observations.push({ path: pathname, scenario, ready: false, error: error.message });
        throw error;
      }
    };

    // One anonymous browser identity across public routes; no consent is saved
    // until every first-visit page has been checked.
    for (const pathname of publicRoutes) {
      await navigateAndVerify(pathname, "first-visit");
    }

    // Save the real consent exactly once through the existing application UI.
    // Persisting once avoids 8 duplicate writes against the shared E2E backend.
    await navigateAndVerify("/login", "first-visit");
    await page.locator(".cookie-consent-actions button").first().click();
    await page.locator(".cookie-consent-backdrop").waitFor({ state: "hidden", timeout: 30000 });

    const persisted = await context.request.get(statusUrl);
    if (!persisted.ok()) {
      throw new Error("Saved consent status returned HTTP " + persisted.status());
    }
    const state = (await persisted.json()).data;
    if (!state?.hasConsent || state.consent?.essential !== true ||
        state.consent?.preferences !== false || state.consent?.analytics !== false ||
        state.consent?.marketing !== false) {
      throw new Error("Real essential-only consent was not persisted");
    }
    const identity = (await context.cookies(statusUrl)).filter(
      (cookie) => cookie.name === "fitvibe_consent_client",
    );
    if (identity.length !== 1) {
      throw new Error("Backend did not issue exactly one consent identity cookie");
    }

    for (const pathname of publicRoutes) {
      await navigateAndVerify(pathname, "consented");
    }
    return observations;
  } finally {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "content-readiness.json"), JSON.stringify(observations, null, 2) + "\n");
    await context.close();
    await browser.close();
  }
}

const scenarios = ["first-visit", "consented"];

async function verifyCurrentConsent(context, origin, scenario) {
  const statusUrl = new URL("/api/v1/consent/cookie-status", origin).toString();
  const response = await context.request.get(statusUrl);
  if (!response.ok()) {
    throw new Error(scenario + ": consent status returned HTTP " + response.status());
  }
  const state = (await response.json()).data;
  if (scenario === "first-visit") {
    if (state?.hasConsent) throw new Error("Unexpected persisted consent on first visit");
  } else if (!state?.hasConsent || state.consent?.essential !== true ||
             state.consent?.preferences !== false || state.consent?.analytics !== false ||
             state.consent?.marketing !== false) {
    throw new Error("Expected backend-persisted essential-only consent");
  }
  return state;
}

async function persistRealBrowserConsent(context, origin) {
  const page = await context.newPage();
  try {
    await page.goto(new URL("/login", origin).toString(), { waitUntil: "domcontentloaded" });
    await verifyPublicContent(page, "/login", "first-visit");
    await page.locator(".cookie-consent-actions button").first().click();
    await page.locator(".cookie-consent-backdrop").waitFor({
      state: "hidden", timeout: 30000,
    });
    await verifyCurrentConsent(context, origin, "consented");
    const consentCookies = (await context.cookies(
      new URL("/api/v1/consent/cookie-status", origin).toString(),
    )).filter((cookie) => cookie.name === "fitvibe_consent_client");
    if (consentCookies.length !== 1) {
      throw new Error("Real backend did not persist one consent browser identity cookie");
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await verifyPublicContent(page, "/login", "consented");
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const rows = [];
  const technicalErrors = [];
  const observations = [];
  let budgetErrors = [];
  let chrome;
  const originInput = process.env.PLAYWRIGHT_BASE_URL;
  const expectedRuns = canonical.ci.collect.numberOfRuns;

  try {
    if (!originInput) throw new Error("PLAYWRIGHT_BASE_URL must select the real E2E ingress");
    const config = publicConfigForOrigin(originInput);
    const origin = new URL(originInput).origin;

    // Confirm the actual production-contract backend before measuring. No
    // mocked APIs, duplicate database, or replacement SSR server.
    for (const endpoint of [
      "/api/v1/consent/cookie-status",
      "/api/v1/auth/register/options",
      "/api/v1/legal/documents/terms?language=en",
      "/api/v1/legal/documents/privacy?language=en",
      "/api/v1/legal/documents/cookie?language=en",
      "/api/v1/csrf-token",
    ]) {
      const response = await fetch(new URL(endpoint, origin), {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Real backend preflight " + endpoint +
        " returned HTTP " + response.status);
    }

    chrome = await launchLighthouseChrome();
    const { default: lighthouse } = await import("lighthouse");
    await verifyCurrentConsent(chrome.context, origin, "first-visit");

    // Three cold-cache navigations per route and scenario. Consent remains
    // an actual backend/cookie state; Network.clearBrowserCache never resets it.
    for (const scenario of scenarios) {
      if (scenario === "consented") {
        await persistRealBrowserConsent(chrome.context, origin);
      }
      await verifyCurrentConsent(chrome.context, origin, scenario);
      const scenarioDir = path.join(outputDir, scenario);
      fs.mkdirSync(scenarioDir, { recursive: true });
      for (const pathname of publicRoutes) {
        for (let run = 1; run <= expectedRuns; run += 1) {
          const id = scenario + ":" + (pathname === "/" ? "home" : pathname.slice(1)) + ":" + run;
          const target = new URL(pathname, origin).toString();
          let output;
          let observed;
          let observationError;
          try {
            await chrome.clearCache();
            const observer = observeNavigation(chrome.context, target,
              (page) => verifyPublicContent(page, pathname, scenario));
            try {
              output = await lighthouse(target, {
                port: chrome.port,
                logLevel: "error",
                disableStorageReset: true,
                throttlingMethod: config.ci.collect.settings.throttlingMethod,
                maxWaitForFcp: config.ci.collect.settings.maxWaitForFcp,
                maxWaitForLoad: config.ci.collect.settings.maxWaitForLoad,
              });
            } finally {
              try { observed = await observer.finish(); }
              catch (error) { observationError = error; }
            }
            if (!output?.lhr) throw new Error("Lighthouse produced no report");
            const report = output.lhr;
            // Always write raw LHR before validating it so unexpected 429,
            // error-content or redirects remain available for investigation.
            fs.writeFileSync(path.join(scenarioDir, "lhr-" + id.replaceAll(":", "-") + ".json"),
              JSON.stringify(report));
            const legacy = assessPublicReport(report, pathname, origin);
            const readiness = observed && { ...observed, pathname, scenario };
            const diagnostic = validateMeasurement(report, {
              mode: "public", pathname, origin, scenario, readiness,
            });
            const errors = [...legacy.errors, ...diagnostic.errors];
            if (observationError) errors.push(observationError.message);
            const valid = errors.length === 0;
            rows.push({ path: pathname, scenario, report, valid });
            observations.push({ id, pathname, scenario, readiness, valid, errors,
              apiRequests: diagnostic.apiRequests, lcpElement: diagnostic.lcpElement });
            if (!valid) technicalErrors.push(id + ": " + errors.join("; "));
          } catch (error) {
            technicalErrors.push(id + ": " + error.message);
            observations.push({ id, pathname, scenario, valid: false,
              errors: [error.message] });
          }
        }
        console.log("Real-backend public Lighthouse " + scenario + " " + pathname +
          ": " + rows.filter((row) => row.path === pathname &&
            row.scenario === scenario && row.valid).length +
          "/" + expectedRuns + " valid runs");
      }
    }

    const records = observations.map((item) => ({
      id: item.id, pathname: item.pathname, scenario: item.scenario,
      valid: item.valid, sameNavigationReady: item.readiness?.ready === true,
    }));
    technicalErrors.push(...assertScenarioCoverage(records, publicRoutes, scenarios, expectedRuns));
    budgetErrors = assertPublicWorstBudgets(rows, publicRoutes, scenarios,
      config.ci.assert.assertions, expectedRuns);
  } catch (error) {
    technicalErrors.push("Real-backend public Lighthouse setup: " + error.message);
  } finally {
    if (chrome) await chrome.close().catch((error) => {
      technicalErrors.push("Lighthouse Chrome cleanup: " + error.message);
    });

    fs.writeFileSync(path.join(outputDir, "observations.json"),
      JSON.stringify(observations, null, 2) + "\n");
    fs.writeFileSync(path.join(outputDir, "content-readiness.json"),
      JSON.stringify(observations.map((item) => ({
        id: item.id, pathname: item.pathname, scenario: item.scenario,
        ...item.readiness, valid: item.valid, errors: item.errors,
      })), null, 2) + "\n");

    const summaries = {};
    for (const scenario of scenarios) {
      summaries[scenario] = writePerformanceReport(path.join(outputDir, scenario), {
        label: "Public routes - " + scenario + " (real backend)",
        paths: publicRoutes,
        results: rows.filter((row) => row.scenario === scenario),
        expectedRuns,
        technicalErrors: technicalErrors.filter((error) => error.startsWith(scenario + ":")),
        budgetErrors: budgetErrors.filter((error) => error.startsWith(scenario + " ")),
      });
    }
    const summary = { scenarios: summaries, expectedRunsPerScenario: expectedRuns,
      expectedMeasurements: publicRoutes.length * expectedRuns * scenarios.length,
      validMeasurements: rows.filter((row) => row.valid).length,
      technicalErrors, budgetErrors,
    };
    fs.writeFileSync(path.join(outputDir, "summary.json"),
      JSON.stringify(summary, null, 2) + "\n");
    fs.writeFileSync(path.join(outputDir, "summary.md"), [
      "# Real-backend public Lighthouse — two consent scenarios",
      "",
      "Valid: " + summary.validMeasurements + "/" + summary.expectedMeasurements +
        " independently measured runs. Cold resource cache per navigation.",
      "Both scenarios use the same isolated browser and persist consent through the real UI/API.",
      "Technical failures: " + technicalErrors.length + ". Budget breaches: " + budgetErrors.length + ".",
      "",
      "See first-visit/summary.md and consented/summary.md for independent worst-run budgets.",
      "",
      ...technicalErrors.map((error) => "- INVALID: " + error),
      ...budgetErrors.map((error) => "- BUDGET: " + error),
    ].join("\n") + "\n");
    console.log("Real-backend public Lighthouse: " + summary.validMeasurements +
      "/" + summary.expectedMeasurements + " valid scenario measurements");
    if (technicalErrors.length) {
      console.error(technicalErrors.join("\n"));
      process.exitCode = 1;
    }
    // Remain diagnostic until this runner has validated CI evidence.
    if (budgetErrors.length) console.warn("Canonical worst-run breaches:\n" +
      budgetErrors.join("\n"));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { publicConfigForOrigin, assessPublicReport, verifyBrowserContentAndConsent };
