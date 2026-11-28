"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const {
  buildPerformanceSummary,
  writePerformanceReport,
} = require("./lighthouse-performance-report.cjs");

const sample = (performance, lcp, lcpLabel = "Calendar") => ({
  path: "/calendar",
  valid: true,
  report: {
    categories: { performance: { score: performance }, accessibility: { score: 0.95 } },
    audits: {
      "lcp-breakdown-insight": { details: { items: [{ type: "node", nodeLabel: lcpLabel }] } },
      "largest-contentful-paint": { numericValue: lcp },
      "total-blocking-time": { numericValue: 70 },
      "cumulative-layout-shift": { numericValue: 0.02 },
      "resource-summary": { details: { items: [{ resourceType: "script", transferSize: 20480 }] } },
    },
  },
});

test("Median-run performance summary retains measured results despite budget breaches", () => {
  const input = {
    label: "Athlete",
    paths: ["/calendar"],
    expectedRuns: 3,
    results: [
      sample(0.6, 3200),
      sample(0.85, 2400, "Would you like to activate two-factor authentication?"),
      sample(0.9, 2200),
    ],
    budgetErrors: ["/calendar: LCP exceeds 3000"],
    log: false,
  };
  const summary = buildPerformanceSummary(input);
  assert.equal(summary.pages[0].status, "measured");
  assert.equal(summary.pages[0].medianLcpMs, 2400);
  assert.equal(summary.pages[0].medianPerformanceScore, 0.85);
  assert.deepEqual(summary.pages[0].lcpRunsMs, [3200, 2400, 2200]);
  // The element of the median run, not of the first, fastest or slowest one.
  assert.equal(
    summary.pages[0].medianLcpElement,
    "Would you like to activate two-factor authentication?",
  );
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-lhr-summary-"));
  try {
    writePerformanceReport(directory, input);
    assert.match(fs.readFileSync(path.join(directory, "summary.md"), "utf8"), /\| 2400 \|/);
    assert.match(
      fs.readFileSync(path.join(directory, "summary.md"), "utf8"),
      /median of valid runs/,
    );
    assert.match(fs.readFileSync(path.join(directory, "summary.md"), "utf8"), /LCP exceeds 3000/);
    assert.match(fs.readFileSync(path.join(directory, "summary.md"), "utf8"), /3200, 2400, 2200/);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(directory, "summary.json"))).measuredPages,
      1,
    );
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
  assert.equal(summary.pages[0].medianLcpMs, null);
  assert.deepEqual(summary.pages[0].lcpRunsMs, []);
  assert.equal(summary.pages[0].medianLcpElement, null);
  assert.equal(summary.measuredPages, 0);
});

test("The full table is written to the step summary when one is available", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-lhr-step-"));
  const stepSummary = path.join(directory, "step-summary.md");
  const previous = process.env.GITHUB_STEP_SUMMARY;
  process.env.GITHUB_STEP_SUMMARY = stepSummary;
  try {
    writePerformanceReport(directory, {
      label: "Athlete",
      paths: ["/calendar"],
      expectedRuns: 1,
      results: [sample(0.9, 2100)],
      log: false,
    });
    assert.match(
      fs.readFileSync(stepSummary, "utf8"),
      /\| \/calendar \| 1\/1 \|.*\| 2100 \| 2100 \| Calendar \|/,
    );
  } finally {
    if (previous === undefined) delete process.env.GITHUB_STEP_SUMMARY;
    else process.env.GITHUB_STEP_SUMMARY = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
