"use strict";
const { auditUrl } = require("./lighthouse-routes.cjs");
const {
  BUDGET_AGGREGATION_METHOD,
  budgetBreaches,
  isMeasured,
  median,
} = require("./lighthouse-aggregation.cjs");
const scriptBytes = (lhr) => {
  const items = lhr.audits?.["resource-summary"]?.details?.items;
  if (!Array.isArray(items)) return null;
  const script = items.find((item) => item.resourceType === "script");
  return script?.transferSize ?? null;
};

function assertMedianRunBudgets(
  reports,
  paths,
  origin,
  assertions,
  numberOfRuns = 3,
  mode = "athlete",
) {
  const errors = [];
  const expected = new Set(paths.map((path) => auditUrl({ mode, path }, origin)));
  for (const report of reports) {
    if (!expected.has(report.requestedUrl)) {
      errors.push("Unexpected authenticated Lighthouse report for " + report.requestedUrl);
    }
  }
  for (const pathname of paths) {
    const url = auditUrl({ mode, path: pathname }, origin);
    const group = reports.filter((report) => report.requestedUrl === url);
    if (group.length !== numberOfRuns) {
      errors.push(pathname + ": expected " + numberOfRuns + " runs, got " + group.length);
      continue;
    }
    for (const [name, policy] of Object.entries(assertions)) {
      // SEO indexing scores are not a meaningful gate for private pages.
      if (name === "categories:seo") continue;
      const [level, options] = policy;
      if (level !== "error" || options?.aggregationMethod !== BUDGET_AGGREGATION_METHOD) {
        errors.push(
          pathname + ": " + name + " is not a " + BUDGET_AGGREGATION_METHOD + " blocking assertion",
        );
        continue;
      }
      let values;
      if (name.startsWith("categories:")) {
        const category = name.slice("categories:".length);
        values = group.map((report) => report.categories?.[category]?.score);
      } else if (name === "largest-contentful-paint") {
        values = group.map((report) => report.audits?.["largest-contentful-paint"]?.numericValue);
      } else if (name === "resource-summary:script.size") {
        values = group.map(scriptBytes);
      } else {
        errors.push(pathname + ": unhandled Lighthouse assertion " + name);
        continue;
      }

      if (!values.every(isMeasured)) {
        errors.push(pathname + ": " + name + " has missing measurements");
        continue;
      }
      errors.push(...budgetBreaches(pathname + ": " + name, median(values), options));
    }
  }
  return errors;
}

module.exports = { assertMedianRunBudgets };
