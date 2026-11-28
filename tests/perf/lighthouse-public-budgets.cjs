"use strict";

const {
  BUDGET_AGGREGATION_METHOD,
  budgetBreaches,
  isMeasured,
  median,
} = require("./lighthouse-aggregation.cjs");

function metric(report, name) {
  if (name.startsWith("categories:")) {
    return report.categories?.[name.slice("categories:".length)]?.score;
  }
  if (name === "largest-contentful-paint") {
    return report.audits?.[name]?.numericValue;
  }
  if (name === "resource-summary:script.size") {
    const items = report.audits?.["resource-summary"]?.details?.items;
    return items?.find((item) => item.resourceType === "script")?.transferSize;
  }
  return undefined;
}

/**
 * Exactly match the canonical CI score/category/LCP/JS thresholds, using the
 * median of three independent runs for each public route AND consent scenario.
 */
function assertPublicMedianBudgets(rows, paths, scenarios, assertions, runCount) {
  const errors = [];
  for (const scenario of scenarios) {
    for (const pathname of paths) {
      const group = rows.filter(
        (row) => row.path === pathname && row.scenario === scenario && row.valid,
      );
      if (group.length !== runCount) {
        errors.push(
          scenario + " " + pathname + ": expected " + runCount + " valid runs, got " + group.length,
        );
        continue;
      }
      for (const [name, policy] of Object.entries(assertions)) {
        const [level, settings] = policy;
        if (level !== "error" || settings?.aggregationMethod !== BUDGET_AGGREGATION_METHOD) {
          errors.push("Nonblocking or non-" + BUDGET_AGGREGATION_METHOD + " budget: " + name);
          continue;
        }
        const values = group.map((row) => metric(row.report, name));
        if (!values.every(isMeasured)) {
          errors.push(scenario + " " + pathname + ": missing metric " + name);
          continue;
        }
        errors.push(
          ...budgetBreaches(scenario + " " + pathname + ": " + name, median(values), settings),
        );
      }
    }
  }
  return errors;
}

module.exports = { assertPublicMedianBudgets };
