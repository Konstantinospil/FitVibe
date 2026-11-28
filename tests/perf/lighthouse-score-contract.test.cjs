"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assertMedianRunBudgets } = require("./lighthouse-score-contract.cjs");
const { BUDGET_AGGREGATION_METHOD } = require("./lighthouse-aggregation.cjs");
const { auditUrl } = require("./lighthouse-routes.cjs");

const origin = "http://127.0.0.1:4180";
const route = { mode: "athlete", path: "/calendar" };
const policy = {
  "categories:performance": [
    "error",
    { minScore: 0.6, aggregationMethod: BUDGET_AGGREGATION_METHOD },
  ],
  "categories:accessibility": [
    "error",
    { minScore: 0.9, aggregationMethod: BUDGET_AGGREGATION_METHOD },
  ],
  "categories:seo": ["error", { minScore: 0.9, aggregationMethod: BUDGET_AGGREGATION_METHOD }],
  "largest-contentful-paint": [
    "error",
    { maxNumericValue: 3000, aggregationMethod: BUDGET_AGGREGATION_METHOD },
  ],
  "resource-summary:script.size": [
    "error",
    { maxNumericValue: 307200, aggregationMethod: BUDGET_AGGREGATION_METHOD },
  ],
};
function report(performance = 0.85, lcp = 2000) {
  return {
    requestedUrl: auditUrl(route, origin),
    categories: {
      performance: { score: performance },
      accessibility: { score: 0.95 },
      seo: { score: 0 },
    },
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "resource-summary": { details: { items: [{ resourceType: "script", transferSize: 10000 }] } },
    },
  };
}
test("Authenticated page budgets enforce the median of three real results", () => {
  assert.deepEqual(
    assertMedianRunBudgets([report(), report(), report()], [route.path], origin, policy),
    [],
  );
  // One outlier run no longer fails the route.
  assert.deepEqual(
    assertMedianRunBudgets(
      [report(0.59, 3312), report(0.9, 2200), report(0.95, 2100)],
      [route.path],
      origin,
      policy,
    ),
    [],
  );
  // A route that is slow in most runs still fails, judged on its median run.
  const failures = assertMedianRunBudgets(
    [report(0.59, 3312), report(0.58, 3050), report(0.95, 2100)],
    [route.path],
    origin,
    policy,
  );
  assert.ok(failures.some((message) => message.includes("performance median 0.59")));
  assert.ok(failures.some((message) => message.includes("largest-contentful-paint median 3050")));
});
test("Authenticated budgets refuse an assertion that is not median-aggregated", () => {
  const pessimistic = {
    "largest-contentful-paint": [
      "error",
      { maxNumericValue: 3000, aggregationMethod: "pessimistic" },
    ],
  };
  assert.ok(
    assertMedianRunBudgets([report(), report(), report()], [route.path], origin, pessimistic).some(
      (message) => message.includes("is not a median blocking assertion"),
    ),
  );
});
test("Lighthouse does not accept a missing result, wrong URL or incomplete metric", () => {
  assert.ok(
    assertMedianRunBudgets([report()], [route.path], origin, policy).some((message) =>
      message.includes("expected 3 runs"),
    ),
  );
  const bad = [report(), report(), { ...report(), requestedUrl: "http://127.0.0.1:4180/login" }];
  assert.ok(
    assertMedianRunBudgets(bad, [route.path], origin, policy).some((message) =>
      message.includes("Unexpected"),
    ),
  );
  const missing = [report(), report(), { ...report(), audits: {} }];
  assert.ok(
    assertMedianRunBudgets(missing, [route.path], origin, policy).some((message) =>
      message.includes("missing measurements"),
    ),
  );
});
