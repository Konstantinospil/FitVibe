"use strict";

const finite = (value) => typeof value === "number" && Number.isFinite(value);

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
 * worst of three independent runs for each public route AND consent scenario.
 */
function assertPublicWorstBudgets(rows, paths, scenarios, assertions, runCount) {
  const errors = [];
  for (const scenario of scenarios) {
    for (const pathname of paths) {
      const group = rows.filter((row) => row.path === pathname &&
        row.scenario === scenario && row.valid);
      if (group.length !== runCount) {
        errors.push(scenario + " " + pathname + ": expected " + runCount +
          " valid runs, got " + group.length);
        continue;
      }
      for (const [name, policy] of Object.entries(assertions)) {
        const [level, settings] = policy;
        if (level !== "error" || settings?.aggregationMethod !== "pessimistic") {
          errors.push("Nonblocking or non-pessimistic budget: " + name);
          continue;
        }
        const values = group.map((row) => metric(row.report, name));
        if (!values.every(finite)) {
          errors.push(scenario + " " + pathname + ": missing metric " + name);
          continue;
        }
        if (settings.minScore !== undefined) {
          const worst = Math.min(...values);
          if (worst < settings.minScore) {
            errors.push(scenario + " " + pathname + ": " + name +
              " worst " + worst + " below " + settings.minScore);
          }
        }
        if (settings.maxNumericValue !== undefined) {
          const worst = Math.max(...values);
          if (worst > settings.maxNumericValue) {
            errors.push(scenario + " " + pathname + ": " + name +
              " worst " + worst + " above " + settings.maxNumericValue);
          }
        }
      }
    }
  }
  return errors;
}

module.exports = { assertPublicWorstBudgets };
