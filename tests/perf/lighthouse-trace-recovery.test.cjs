"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  MAX_TRACE_RECOVERIES_PER_STEP,
  shouldRetryTraceFailure,
  traceFailureCode,
} = require("./lighthouse-trace-recovery.cjs");

// The failure seen in CI run 45077744634 (first-visit:home:1).
const noNavstart = () => ({
  runtimeError: {
    code: "NO_NAVSTART",
    message:
      "Something went wrong with recording the trace over your page load. " +
      "Please run Lighthouse again. (NO_NAVSTART)",
  },
  audits: { "largest-contentful-paint": { numericValue: null } },
});

const measured = (lcp) => ({
  audits: { "largest-contentful-paint": { numericValue: lcp } },
});

test("A run whose trace was not recorded is re-collected once", () => {
  assert.equal(traceFailureCode(noNavstart()), "NO_NAVSTART");
  assert.equal(shouldRetryTraceFailure(noNavstart(), 1, 0), true);
  assert.equal(shouldRetryTraceFailure(noNavstart(), 2, 0), false);
});

test("A measured run is never retried, however slow", () => {
  assert.equal(shouldRetryTraceFailure(measured(9000), 1, 0), false);
  // Even if Lighthouse also reported a trace error, a measured LCP stands.
  assert.equal(shouldRetryTraceFailure({ ...noNavstart(), ...measured(4200) }, 1, 0), false);
});

test("Errors that can reflect the page itself are not retried", () => {
  for (const code of [
    "NO_FCP",
    "NO_LCP",
    "FAILED_DOCUMENT_REQUEST",
    "ERRORED_DOCUMENT_REQUEST",
    "PAGE_HUNG",
    "PROTOCOL_TIMEOUT",
    "CRI_TIMEOUT",
    "NOT_HTML",
  ]) {
    const report = { runtimeError: { code, message: code }, audits: {} };
    assert.equal(shouldRetryTraceFailure(report, 1, 0), false, code);
  }
  assert.equal(shouldRetryTraceFailure({ audits: {} }, 1, 0), false);
});

test("Systematic trace breakage still fails the step", () => {
  assert.equal(shouldRetryTraceFailure(noNavstart(), 1, MAX_TRACE_RECOVERIES_PER_STEP - 1), true);
  assert.equal(shouldRetryTraceFailure(noNavstart(), 1, MAX_TRACE_RECOVERIES_PER_STEP), false);
});
