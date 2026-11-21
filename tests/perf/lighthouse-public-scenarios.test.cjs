"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertPublicWorstBudgets } = require("./lighthouse-public-budgets.cjs");
const { publicRoutes } = require("./lighthouse-routes.cjs");

const canonical = JSON.parse(fs.readFileSync(
  path.join(__dirname, "lighthouserc.ci.json"), "utf8",
));
const config = canonical.ci.assert.assertions;
const scenarios = ["first-visit", "consented"];
function goodReport() {
  return {
    categories: Object.fromEntries(
      ["performance", "accessibility", "best-practices", "seo"]
        .map((name) => [name, { score: 1 }]),
    ),
    audits: {
      "largest-contentful-paint": { numericValue: 1800 },
      "resource-summary": { details: { items: [
        { resourceType: "script", transferSize: 125000 },
      ] } },
    },
  };
}
function rows() {
  return scenarios.flatMap((scenario) => publicRoutes.flatMap((pathname) =>
    [1, 2, 3].map(() => ({
      path: pathname, scenario, valid: true, report: goodReport(),
    })),
  ));
}
test("public scenario budgets enforce all canonical pessimistic thresholds independently", () => {
  const result = rows();
  assert.equal(result.length, 48);
  assert.deepEqual(assertPublicWorstBudgets(
    result, publicRoutes, scenarios, config, canonical.ci.collect.numberOfRuns,
  ), []);
  // A single slow measurement must fail even when other two are fast.
  result[1].report.audits["largest-contentful-paint"].numericValue = 3200;
  const errors = assertPublicWorstBudgets(result, publicRoutes, scenarios, config, 3);
  assert.match(errors.join("; "), /first-visit \/: largest-contentful-paint worst 3200 above 3000/);
  assert.ok(!errors.some((text) => text.startsWith("consented ")));
});
test("missing/invalid measurements and worst JavaScript transfer are blocking", () => {
  const result = rows();
  result.splice(0, 1);
  assert.match(assertPublicWorstBudgets(result, publicRoutes, scenarios, config, 3).join("; "),
    /expected 3 valid runs, got 2/);

  const complete = rows();
  complete[0].report.audits["resource-summary"].details.items[0].transferSize = 307201;
  assert.match(assertPublicWorstBudgets(complete, publicRoutes, scenarios, config, 3).join("; "),
    /resource-summary:script.size worst 307201 above 307200/);
  complete[0].report.audits["resource-summary"].details.items[0].transferSize = undefined;
  assert.match(assertPublicWorstBudgets(complete, publicRoutes, scenarios, config, 3).join("; "),
    /missing metric resource-summary:script.size/);
});
test("real public diagnostic must observe the measured tab and collect both states", () => {
  const source = fs.readFileSync(path.join(__dirname, "run-lighthouse-public-real.cjs"), "utf8");
  assert.match(source, /const scenarios = \["first-visit", "consented"\]/);
  assert.match(source, /observeNavigation\(chrome\.context, target/);
  assert.match(source, /verifyPublicContent\(page, pathname, scenario\)/);
  assert.match(source, /persistRealBrowserConsent\(chrome\.context, origin\)/);
  assert.match(source, /await chrome\.clearCache\(\)/);
  assert.match(source, /assertScenarioCoverage\(records, publicRoutes, scenarios, expectedRuns\)/);
  assert.doesNotMatch(source, /spawnSync\("pnpm"/);
});
