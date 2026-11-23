"use strict";

// Lighthouse sometimes fails to record its own performance trace (for example
// NO_NAVSTART: the trace has no navigationStart event). Such a run measured
// nothing, so it says nothing about the page. A bounded rerun of exactly that
// run keeps the required number of *measured* runs without weakening validity:
// - only Lighthouse's own tracing-infrastructure codes qualify; codes that can
//   reflect the page itself (NO_FCP, document request failures, timeouts) do not;
// - a report that contains any LCP value is never retried, so a measured
//   result, slow or not, can never be replaced by a better one;
// - one retry per run, and a cap per step, so systematic breakage still fails;
// - the caller keeps every attempt's report and logs every recovery.
const TRACE_FAILURE_CODES = new Set([
  "NO_NAVSTART",
  "NO_TRACING_STARTED",
  "TRACING_ALREADY_STARTED",
]);

const MAX_TRACE_RETRIES_PER_RUN = 1;
const MAX_TRACE_RECOVERIES_PER_STEP = 3;

function traceFailureCode(report) {
  const code = report?.runtimeError?.code;
  return typeof code === "string" && TRACE_FAILURE_CODES.has(code) ? code : null;
}

function hasMeasuredLcp(report) {
  const value = report?.audits?.["largest-contentful-paint"]?.numericValue;
  return typeof value === "number" && Number.isFinite(value);
}

function shouldRetryTraceFailure(
  report,
  attempt,
  recoveriesSoFar,
  maxRetries = MAX_TRACE_RETRIES_PER_RUN,
  maxRecoveries = MAX_TRACE_RECOVERIES_PER_STEP,
) {
  if (attempt > maxRetries || recoveriesSoFar >= maxRecoveries) return false;
  if (!traceFailureCode(report)) return false;
  return !hasMeasuredLcp(report);
}

module.exports = {
  MAX_TRACE_RECOVERIES_PER_STEP,
  MAX_TRACE_RETRIES_PER_RUN,
  TRACE_FAILURE_CODES,
  shouldRetryTraceFailure,
  traceFailureCode,
};
