"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assertWorstRunBudgets } = require("./lighthouse-score-contract.cjs");
const { auditUrl } = require("./lighthouse-routes.cjs");

const origin = "http://127.0.0.1:4180";
const route = { mode: "athlete", path: "/calendar" };
const policy = {
  "categories:performance": ["error", { minScore: 0.6, aggregationMethod: "pessimistic" }],
  "categories:accessibility": ["error", { minScore: 0.9, aggregationMethod: "pessimistic" }],
  "categories:seo": ["error", { minScore: 0.9, aggregationMethod: "pessimistic" }],
  "largest-contentful-paint": ["error", { maxNumericValue: 3000, aggregationMethod: "pessimistic" }],
  "resource-summary:script.size": ["error", { maxNumericValue: 307200, aggregationMethod: "pessimistic" }],
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
test("Authenticated page budgets enforce the worst of three real results", () => {
  assert.deepEqual(assertWorstRunBudgets([report(), report(), report()], [route.path], origin, policy), []);
  const failures = assertWorstRunBudgets(
    [report(0.59, 3312), report(0.9, 2200), report(0.95, 2100)],
    [route.path], origin, policy,
  );
  assert.ok(failures.some((message) => message.includes("performance worst 0.59")));
  assert.ok(failures.some((message) => message.includes("largest-contentful-paint worst 3312")));
});
test("Lighthouse does not accept a missing result, wrong URL or incomplete metric", () => {
  assert.ok(assertWorstRunBudgets([report()], [route.path], origin, policy).some((message) => message.includes("expected 3 runs")));
  const bad = [report(), report(), { ...report(), requestedUrl: "http://127.0.0.1:4180/login" }];
  assert.ok(assertWorstRunBudgets(bad, [route.path], origin, policy).some((message) => message.includes("Unexpected")));
  const missing = [report(), report(), { ...report(), audits: {} }];
  assert.ok(assertWorstRunBudgets(missing, [route.path], origin, policy).some((message) => message.includes("missing measurements")));
});
