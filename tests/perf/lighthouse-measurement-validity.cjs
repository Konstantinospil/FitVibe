"use strict";

/**
 * A Lighthouse score is not proof that the intended application loaded.
 * Validate observed requests and LCP before counting a run. DOM-readiness
 * evidence must be attached separately to the SAME Lighthouse navigation.
 */
const { auditUrl } = require("./lighthouse-routes.cjs");

const REQUIRED_PUBLIC_API = Object.freeze({
  "/": ["/api/v1/consent/cookie-status"],
  "/login": ["/api/v1/consent/cookie-status"],
  "/register": ["/api/v1/auth/register/options"],
  "/forgot-password": ["/api/v1/consent/cookie-status"],
  "/terms": ["/api/v1/legal/documents/terms"],
  "/privacy": ["/api/v1/legal/documents/privacy"],
  "/cookie": ["/api/v1/legal/documents/cookie"],
  "/contact": ["/api/v1/csrf-token"],
});

function networkRequests(report) {
  const requests = report?.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(requests)) throw new Error("Missing Lighthouse network request evidence");
  return requests;
}

function scriptTransfer(report, requests) {
  const entries = report?.audits?.["resource-summary"]?.details?.items;
  if (!Array.isArray(entries)) return "Missing Lighthouse resource summary";
  const scripts = entries.find((item) => item.resourceType === "script");
  const loadedScripts = requests.filter((item) => {
    try { return new URL(item.url).pathname.endsWith(".js"); }
    catch { return false; }
  });
  if (!scripts || !Number.isFinite(scripts.transferSize) || scripts.transferSize <= 0 ||
      scripts.requestCount < 1 || loadedScripts.length === 0) {
    return "Invalid script transfer: audited page used no measurable JavaScript transfer";
  }
  return null;
}

function validateMeasurement(report, {
  mode, pathname, origin, scenario, readiness,
  requireReadiness = true,
}) {
  const errors = [];
  const expected = mode === "athlete"
    ? auditUrl({ mode, path: pathname }, origin)
    : new URL(pathname, origin).toString();
  if (report.requestedUrl !== expected) {
    errors.push("Requested URL does not identify the audited route");
  }
  let final;
  try { final = new URL(report.finalDisplayedUrl || report.finalUrl); }
  catch { errors.push("Missing or invalid final URL"); }
  const target = new URL(expected);
  if (final && (final.origin !== target.origin || final.pathname !== target.pathname)) {
    errors.push("Audited route redirected or replaced");
  }
  if (report.runtimeError) errors.push("Lighthouse runtime error: " + report.runtimeError.message);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    if (!Number.isFinite(report.categories?.[category]?.score)) {
      errors.push("Missing numeric Lighthouse category " + category);
    }
  }

  let requests = [];
  try { requests = networkRequests(report); }
  catch (error) { errors.push(error.message); }
  const api = requests.filter((request) => {
    try {
      const url = new URL(request.url);
      return url.origin === target.origin && url.pathname.startsWith("/api/v1/");
    } catch { return false; }
  });
  for (const request of api) {
    if (!Number.isInteger(request.statusCode) || request.statusCode < 200 ||
        request.statusCode >= 400) {
      errors.push("Backend HTTP " + request.statusCode + " on " + new URL(request.url).pathname);
    }
  }
  if (mode === "public") {
    for (const required of REQUIRED_PUBLIC_API[pathname] ?? []) {
      if (!api.some((item) => new URL(item.url).pathname === required &&
                    item.statusCode >= 200 && item.statusCode < 400)) {
        errors.push("Missing successful backend response for " + required);
      }
    }
  }
  const scriptError = scriptTransfer(report, requests);
  if (scriptError) errors.push(scriptError);

  const lcp = report?.audits?.["lcp-breakdown-insight"]?.details?.items?.find(
    (item) => item.type === "node",
  );
  const lcpText = lcp?.nodeLabel?.trim() ?? "";
  const lcpSelector = lcp?.selector ?? "";
  const consentOverlayLcp = lcpSelector.includes("cookie-consent-backdrop") ||
    lcpSelector.includes("cookie-consent-dialog");
  if (/^(?:error|common\.error)$/i.test(lcpText)) {
    errors.push("LCP measures error instead of content");
  }
  if ((mode === "athlete" || scenario === "consented") &&
      (consentOverlayLcp || /choose which cookies you want to allow/i.test(lcpText))) {
    errors.push("LCP measures unexpected cookie consent overlay");
  }

  if (requireReadiness) {
    if (!readiness || readiness.requestedUrl !== expected ||
        readiness.scenario !== scenario || !readiness.ready ||
        readiness.pathname !== pathname) {
      errors.push("Missing same-navigation DOM content and consent readiness evidence");
    }
    if (readiness && (readiness.errorVisible || readiness.loadingVisible)) {
      errors.push("Audited page displayed loading/error fallback");
    }
  }
  return { errors, apiRequests: api.length, lcpElement: lcpText || null, lcpSelector: lcpSelector || null };
}


/**
 * Gate candidate promotion: a page is covered only when every scenario has
 * exactly the expected number of distinct valid, same-navigation measurements.
 * A successful preflight, duplicated JSON file, or one scenario cannot fill a
 * missing Lighthouse run.
 */
function assertScenarioCoverage(records, paths, scenarios, numberOfRuns = 3) {
  const errors = [];
  if (!Number.isInteger(numberOfRuns) || numberOfRuns < 3) {
    errors.push("Expected at least three independently collected runs");
  }
  const expected = new Set(paths.flatMap((pathname) =>
    scenarios.map((scenario) => pathname + ":" + scenario)));
  const groups = new Map([...expected].map((key) => [key, []]));
  const identities = new Set();
  for (const record of records) {
    const key = record.pathname + ":" + record.scenario;
    if (!groups.has(key)) {
      errors.push("Unexpected Lighthouse route/scenario: " + key);
      continue;
    }
    if (!record.id || identities.has(record.id)) {
      errors.push("Missing or duplicate Lighthouse run identity for " + key);
    } else {
      identities.add(record.id);
    }
    groups.get(key).push(record);
    if (!record.valid || !record.sameNavigationReady) {
      errors.push("Unvalidated same-navigation measurement: " + key);
    }
  }
  for (const [key, runs] of groups) {
    if (runs.length !== numberOfRuns) {
      errors.push(key + ": expected " + numberOfRuns + " runs, observed " + runs.length);
    }
  }
  return errors;
}

module.exports = { REQUIRED_PUBLIC_API, validateMeasurement, scriptTransfer, networkRequests, assertScenarioCoverage };
