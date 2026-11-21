"use strict";
const { auditUrl } = require("./lighthouse-routes.cjs");

const numeric = (value) => typeof value === "number" && Number.isFinite(value);
const scriptBytes = (lhr) => {
  const items = lhr.audits?.["resource-summary"]?.details?.items;
  if (!Array.isArray(items)) return null;
  const script = items.find((item) => item.resourceType === "script");
  return script?.transferSize ?? null;
};

function assertWorstRunBudgets(reports, paths, origin, assertions, numberOfRuns = 3) {
  const errors = [];
  const expected = new Set(paths.map((path) => auditUrl({ mode: "athlete", path }, origin)));
  for (const report of reports) {
    if (!expected.has(report.requestedUrl)) {
      errors.push("Unexpected authenticated Lighthouse report for " + report.requestedUrl);
    }
  }
  for (const pathname of paths) {
    const url = auditUrl({ mode: "athlete", path: pathname }, origin);
    const group = reports.filter((report) => report.requestedUrl === url);
    if (group.length !== numberOfRuns) {
      errors.push(pathname + ": expected " + numberOfRuns + " runs, got " + group.length);
      continue;
    }
    for (const [name, policy] of Object.entries(assertions)) {
      // SEO indexing scores are not a meaningful gate for private pages.
      if (name === "categories:seo") continue;
      const [level, options] = policy;
      if (level !== "error" || options?.aggregationMethod !== "pessimistic") {
        errors.push(pathname + ": " + name + " is not a pessimistic blocking assertion");
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

      if (!values.every(numeric)) {
        errors.push(pathname + ": " + name + " has missing measurements");
        continue;
      }
      const worst = options.minScore !== undefined ? Math.min(...values) : Math.max(...values);
      if (options.minScore !== undefined && worst < options.minScore) {
        errors.push(pathname + ": " + name + " worst " + worst + " is below " + options.minScore);
      }
      if (options.maxNumericValue !== undefined && worst > options.maxNumericValue) {
        errors.push(pathname + ": " + name + " worst " + worst + " exceeds " + options.maxNumericValue);
      }
    }
  }
  return errors;
}

module.exports = { assertWorstRunBudgets };
