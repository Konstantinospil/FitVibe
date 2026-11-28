"use strict";

/**
 * One aggregation rule for every Lighthouse budget and report in CI.
 *
 * Budgets judge the median of the valid runs for each route. Taking the worst
 * run let a single noisy outlier fail the gate: routes sat within ±60 ms of
 * the LCP budget, so pass/fail was decided by noise (see
 * FRONTEND_AUTHENTICATED_STARTUP.md §3). The median ignores one outlier in
 * three runs but still fails a page that is slow in most of them.
 *
 * LHCI's own `aggregationMethod` uses the same name, so lighthouserc.ci.json
 * and the custom runners stay in step.
 */
const BUDGET_AGGREGATION_METHOD = "median";

const isMeasured = (value) => typeof value === "number" && Number.isFinite(value);

/** Median of finite numbers; the mean of the two middle values for an even count. */
function median(values) {
  const sorted = values.filter(isMeasured).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The run whose value is the median (the lower middle run for an even count). */
function medianEntry(entries, read) {
  const measured = entries
    .map((entry) => ({ entry, value: read(entry) }))
    .filter(({ value }) => isMeasured(value))
    .sort((a, b) => a.value - b.value);
  if (!measured.length) return null;
  return measured[Math.floor((measured.length - 1) / 2)].entry;
}

/** Budget errors for one aggregated metric value against an LHCI assertion's options. */
function budgetBreaches(label, value, options) {
  const errors = [];
  if (options.minScore !== undefined && value < options.minScore) {
    errors.push(label + " median " + value + " is below " + options.minScore);
  }
  if (options.maxNumericValue !== undefined && value > options.maxNumericValue) {
    errors.push(label + " median " + value + " exceeds " + options.maxNumericValue);
  }
  return errors;
}

module.exports = {
  BUDGET_AGGREGATION_METHOD,
  budgetBreaches,
  isMeasured,
  median,
  medianEntry,
};
