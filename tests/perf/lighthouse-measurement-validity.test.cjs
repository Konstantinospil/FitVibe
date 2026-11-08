"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateMeasurement } = require("./lighthouse-measurement-validity.cjs");
const { auditUrl, publicRoutes, athleteRoutes } = require("./lighthouse-routes.cjs");
const origin = "http://127.0.0.1:4180";

function report(mode = "public", pathname = "/terms", scenario = "first-visit") {
  const requestedUrl = mode === "athlete"
    ? auditUrl({ mode, path: pathname }, origin)
    : new URL(pathname, origin).toString();
  const apiRoute = mode === "athlete"
    ? "/api/v1/users/me"
    : pathname === "/register" ? "/api/v1/auth/register/options"
    : ["/terms", "/privacy", "/cookie"].includes(pathname)
      ? "/api/v1/legal/documents/" + pathname.slice(1)
      : pathname === "/contact" ? "/api/v1/csrf-token"
      : "/api/v1/consent/cookie-status";
  return {
    requestedUrl,
    finalDisplayedUrl: requestedUrl,
    categories: Object.fromEntries(
      ["performance", "accessibility", "best-practices", "seo"].map(
        (category) => [category, { score: 0.9 }],
      ),
    ),
    audits: {
      "network-requests": { details: { items: [
        { url: new URL(apiRoute, origin).toString(), statusCode: 200 },
        { url: new URL("/assets/js/main.js", origin).toString(), statusCode: 200, transferSize: 4000 },
      ] } },
      "resource-summary": { details: { items: [
        { resourceType: "script", transferSize: 4000, requestCount: 1 },
      ] } },
      "lcp-breakdown-insight": { details: { items: [
        { type: "node", nodeLabel: "Published page content" },
      ] } },
    },
  };
}

const readinessFor = (r, scenario) => ({
  requestedUrl: r.requestedUrl, pathname: new URL(r.requestedUrl).pathname,
  scenario, ready: true, errorVisible: false, loadingVisible: false,
});

test("all eight public and athlete routes are valid only with real report evidence", () => {
  for (const pathname of publicRoutes) {
    const r = report("public", pathname);
    const actual = validateMeasurement(r, {
      mode: "public", pathname, origin, scenario: "first-visit",
      readiness: readinessFor(r, "first-visit"),
    });
    assert.deepEqual(actual.errors, [], pathname);
  }
  for (const pathname of athleteRoutes) {
    const r = report("athlete", pathname, "consented");
    assert.deepEqual(validateMeasurement(r, {
      mode: "athlete", pathname, origin, scenario: "consented",
      readiness: readinessFor(r, "consented"),
    }).errors, [], pathname);
  }
});

test("negative control: a standalone legal error page with valid Lighthouse scores is invalid", () => {
  const r = report();
  r.audits["network-requests"].details.items[0].statusCode = 404;
  r.audits["lcp-breakdown-insight"].details.items[0].nodeLabel = "Error";
  const errors = validateMeasurement(r, {
    mode: "public", pathname: "/terms", origin, scenario: "first-visit",
    requireReadiness: false,
  }).errors.join("; ");
  assert.match(errors, /Backend HTTP 404/);
  assert.match(errors, /Missing successful backend response/);
  assert.match(errors, /LCP measures error/);
});

test("negative control: cached authenticated JS transfers cannot count as a valid cold transfer measurement", () => {
  const r = report("athlete", "/library", "consented");
  r.audits["resource-summary"].details.items[0].transferSize = 0;
  assert.match(validateMeasurement(r, {
    mode: "athlete", pathname: "/library", origin, scenario: "consented",
    requireReadiness: false,
  }).errors.join("; "), /Invalid script transfer/);
});

test("negative control: rate-limited consent plus an unexpected overlay invalidates an athlete run", () => {
  const r = report("athlete", "/library", "consented");
  r.audits["network-requests"].details.items.push({
    url: new URL("/api/v1/consent/cookie-status", origin).toString(), statusCode: 429,
  });
  r.audits["lcp-breakdown-insight"].details.items[0].nodeLabel =
    "Choose which cookies you want to allow. Essential cookies are required";
  const errors = validateMeasurement(r, {
    mode: "athlete", pathname: "/library", origin, scenario: "consented",
    requireReadiness: false,
  }).errors.join("; ");
  assert.match(errors, /Backend HTTP 429/);
  assert.match(errors, /unexpected cookie consent overlay/);
});

test("same-navigation evidence must not be replaced by another route, consent state or missing result", () => {
  const r = report();
  const options = { mode: "public", pathname: "/terms", origin, scenario: "first-visit" };
  assert.match(validateMeasurement(r, options).errors.join("; "), /Missing same-navigation/);
  const readiness = readinessFor(r, "consented");
  assert.match(validateMeasurement(r, { ...options, readiness }).errors.join("; "), /Missing same-navigation/);
  assert.match(validateMeasurement(r, {
    ...options, readiness: { ...readinessFor(r, "first-visit"), pathname: "/privacy" },
  }).errors.join("; "), /Missing same-navigation/);
  assert.match(validateMeasurement(r, {
    ...options, readiness: { ...readinessFor(r, "first-visit"), loadingVisible: true },
  }).errors.join("; "), /fallback/);
  assert.match(validateMeasurement(r, {
    ...options, readiness: { ...readinessFor(r, "first-visit"), errorVisible: true },
  }).errors.join("; "), /fallback/);
});

test("missing network evidence, wrong page and missing category cannot silently count", () => {
  const r = report();
  const options = { mode: "public", pathname: "/terms", origin, scenario: "first-visit", requireReadiness: false };
  delete r.audits["network-requests"];
  assert.match(validateMeasurement(r, options).errors.join("; "), /Missing Lighthouse network request evidence/);
  const wrong = report();
  wrong.finalDisplayedUrl = new URL("/login", origin).toString();
  assert.match(validateMeasurement(wrong, options).errors.join("; "), /redirected or replaced/);
  const incomplete = report();
  delete incomplete.categories.performance;
  assert.match(validateMeasurement(incomplete, options).errors.join("; "), /Missing numeric Lighthouse category performance/);
});

test("promotion requires 3 unique real Lighthouse runs per route and consent scenario", () => {
  const { assertScenarioCoverage } = require("./lighthouse-measurement-validity.cjs");
  const scenarios = ["first-visit", "consented"];
  const records = publicRoutes.flatMap((pathname) => scenarios.flatMap((scenario) =>
    [1, 2, 3].map((run) => ({
      id: pathname + ":" + scenario + ":" + run,
      pathname, scenario, valid: true, sameNavigationReady: true,
    })),
  ));
  assert.equal(records.length, 48);
  assert.deepEqual(assertScenarioCoverage(records, publicRoutes, scenarios, 3), []);

  const singleScenario = records.filter((row) => row.scenario === "first-visit");
  const missing = assertScenarioCoverage(singleScenario, publicRoutes, scenarios, 3).join("; ");
  assert.match(missing, /consented: expected 3 runs, observed 0/);

  const duplicate = records.map((record) => ({ ...record }));
  duplicate[1].id = duplicate[0].id;
  assert.match(assertScenarioCoverage(duplicate, publicRoutes, scenarios, 3).join("; "),
    /duplicate Lighthouse run identity/);

  const priorPreflight = records.map((record) => ({ ...record }));
  priorPreflight[0].sameNavigationReady = false;
  assert.match(assertScenarioCoverage(priorPreflight, publicRoutes, scenarios, 3).join("; "),
    /Unvalidated same-navigation measurement/);

  const hiddenFailure = records.map((record) => ({ ...record }));
  hiddenFailure[0].valid = false;
  assert.match(assertScenarioCoverage(hiddenFailure, publicRoutes, scenarios, 3).join("; "),
    /Unvalidated same-navigation measurement/);

  assert.match(assertScenarioCoverage(records, publicRoutes, scenarios, 2).join("; "),
    /at least three/);
});

test("localized consent overlay is identified by its DOM selector, not English copy", () => {
  const r = report("athlete", "/library", "consented");
  r.audits["lcp-breakdown-insight"].details.items[0] = {
    type: "node", nodeLabel: "Επιλέξτε προτιμήσεις",
    selector: "div#root > div.cookie-consent-backdrop > section.cookie-consent-dialog > p",
  };
  assert.match(validateMeasurement(r, {
    mode: "athlete", pathname: "/library", origin, scenario: "consented",
    requireReadiness: false,
  }).errors.join("; "), /unexpected cookie consent overlay/);
});
