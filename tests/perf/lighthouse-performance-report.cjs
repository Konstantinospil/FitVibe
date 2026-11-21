"use strict";
const fs = require("node:fs");
const path = require("node:path");

function worst(entries, read, direction = "max") {
  const values = entries.map(({ report }) => read(report)).filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  return values.length === entries.length && values.length
    ? (direction === "min" ? Math.min(...values) : Math.max(...values))
    : null;
}

function scriptBytes(report) {
  const resources = report.audits?.["resource-summary"]?.details?.items;
  return Array.isArray(resources)
    ? resources.find((item) => item.resourceType === "script")?.transferSize
    : null;
}

function buildPerformanceSummary({ label, paths, results, expectedRuns, technicalErrors = [], budgetErrors = [] }) {
  const pages = paths.map((pathname) => {
    const rows = results.filter((entry) => entry.path === pathname);
    const valid = rows.filter((entry) => entry.valid === true);
    return {
      path: pathname,
      attemptedRuns: rows.length,
      validRuns: valid.length,
      expectedRuns,
      status: valid.length === expectedRuns ? "measured" : "incomplete",
      worstPerformanceScore: worst(valid, (r) => r.categories?.performance?.score, "min"),
      worstAccessibilityScore: worst(valid, (r) => r.categories?.accessibility?.score, "min"),
      worstLcpMs: worst(valid, (r) => r.audits?.["largest-contentful-paint"]?.numericValue),
      worstTbtMs: worst(valid, (r) => r.audits?.["total-blocking-time"]?.numericValue),
      worstCls: worst(valid, (r) => r.audits?.["cumulative-layout-shift"]?.numericValue),
      worstScriptBytes: worst(valid, scriptBytes),
    };
  });
  return {
    label,
    expectedRuns,
    expectedPages: paths.length,
    measuredPages: pages.filter((page) => page.status === "measured").length,
    pages,
    technicalErrors,
    budgetErrors,
  };
}

function markdownReport(summary) {
  const display = (value, decimals = 0) =>
    value === null ? "—" : (Number(value).toFixed(decimals));
  const rows = summary.pages.map((page) =>
    "| " + [
      page.path,
      page.validRuns + "/" + page.expectedRuns,
      display(page.worstPerformanceScore === null ? null : page.worstPerformanceScore * 100),
      display(page.worstLcpMs),
      display(page.worstTbtMs),
      display(page.worstCls, 3),
      display(page.worstScriptBytes === null ? null : page.worstScriptBytes / 1024),
      page.status,
    ].join(" | ") + " |",
  );
  const sections = [
    "# " + summary.label + " — Lighthouse performance",
    "",
    "Measured " + summary.measuredPages + "/" + summary.expectedPages +
      " pages. Performance scores and numeric metrics are **worst of valid runs**.",
    "",
    "| Route | Valid runs | Performance / 100 | LCP ms | TBT ms | CLS | JS transfer KiB | Collection |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows,
    "",
    "Budget checks are separate from collection: a breached budget does not discard measured reports.",
  ];
  if (summary.technicalErrors.length) {
    sections.push("", "## Collection or identity failures", "",
      ...summary.technicalErrors.map((message) => "- " + message));
  }
  if (summary.budgetErrors.length) {
    sections.push("", "## Budget breaches", "",
      ...summary.budgetErrors.map((message) => "- " + message));
  }
  return sections.join("\n") + "\n";
}

function writePerformanceReport(directory, input) {
  const summary = buildPerformanceSummary(input);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  fs.writeFileSync(path.join(directory, "summary.md"), markdownReport(summary));
  return summary;
}

module.exports = { buildPerformanceSummary, markdownReport, writePerformanceReport };
