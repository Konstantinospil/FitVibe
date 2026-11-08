"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { buildPerformanceSummary, writePerformanceReport } = require("./lighthouse-performance-report.cjs");

const sample = (performance, lcp) => ({
  path: "/calendar",
  valid: true,
  report: {
    categories: { performance: { score: performance }, accessibility: { score: 0.95 } },
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "total-blocking-time": { numericValue: 70 },
      "cumulative-layout-shift": { numericValue: 0.02 },
      "resource-summary": { details: { items: [
        { resourceType: "script", transferSize: 20480 },
      ] } },
    },
  },
});

test("Worst-run performance summary retains measured results despite budget breaches", () => {
  const input = {
    label: "Athlete",
    paths: ["/calendar"],
    expectedRuns: 3,
    results: [sample(0.6, 3200), sample(0.85, 2400), sample(0.9, 2200)],
    budgetErrors: ["/calendar: LCP exceeds 3000"],
  };
  const summary = buildPerformanceSummary(input);
  assert.equal(summary.pages[0].status, "measured");
  assert.equal(summary.pages[0].worstLcpMs, 3200);
  assert.equal(summary.pages[0].worstPerformanceScore, 0.6);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-lhr-summary-"));
  try {
    writePerformanceReport(directory, input);
    assert.match(fs.readFileSync(path.join(directory, "summary.md"), "utf8"), /3200/);
    assert.match(fs.readFileSync(path.join(directory, "summary.md"), "utf8"), /LCP exceeds 3000/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "summary.json"))).measuredPages, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Redirected or missing pages remain explicitly incomplete", () => {
  const summary = buildPerformanceSummary({
    label: "Public",
    paths: ["/cookie"],
    expectedRuns: 3,
    results: [{ ...sample(0.6, 1800), path: "/cookie", valid: false }],
    technicalErrors: ["/cookie redirected to login"],
  });
  assert.equal(summary.pages[0].status, "incomplete");
  assert.equal(summary.pages[0].worstLcpMs, null);
  assert.equal(summary.measuredPages, 0);
});
