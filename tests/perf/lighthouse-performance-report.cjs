"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { isMeasured, median, medianEntry } = require("./lighthouse-aggregation.cjs");

// The value the budget judges: the median of the valid runs, or null when any
// valid run lacks the metric (a partial set would hide a missing measurement).
function medianOfRuns(entries, read) {
  const values = entries.map(({ report }) => read(report));
  return values.length && values.every(isMeasured) ? median(values) : null;
}

const lcpMs = (report) => report?.audits?.["largest-contentful-paint"]?.numericValue;

function scriptBytes(report) {
  const resources = report.audits?.["resource-summary"]?.details?.items;
  return Array.isArray(resources)
    ? resources.find((item) => item.resourceType === "script")?.transferSize
    : null;
}

// The element Lighthouse attributed LCP to in the median valid run, so the log
// shows *what* the gate timed (page content, an overlay, a fallback...).
function medianRunLcpElement(entries) {
  const medianRun = medianEntry(entries, (entry) => lcpMs(entry.report));
  const node = medianRun?.report?.audits?.["lcp-breakdown-insight"]?.details?.items?.find(
    (item) => item.type === "node",
  );
  const label =
    typeof node?.nodeLabel === "string" ? node.nodeLabel.trim().replace(/\s+/g, " ") : "";
  return label ? label.slice(0, 60) : null;
}

function buildPerformanceSummary({
  label,
  paths,
  results,
  expectedRuns,
  technicalErrors = [],
  budgetErrors = [],
}) {
  const pages = paths.map((pathname) => {
    const rows = results.filter((entry) => entry.path === pathname);
    const valid = rows.filter((entry) => entry.valid === true);
    return {
      path: pathname,
      attemptedRuns: rows.length,
      validRuns: valid.length,
      expectedRuns,
      status: valid.length === expectedRuns ? "measured" : "incomplete",
      medianPerformanceScore: medianOfRuns(valid, (r) => r.categories?.performance?.score),
      medianAccessibilityScore: medianOfRuns(valid, (r) => r.categories?.accessibility?.score),
      medianLcpMs: medianOfRuns(valid, lcpMs),
      medianTbtMs: medianOfRuns(valid, (r) => r.audits?.["total-blocking-time"]?.numericValue),
      medianCls: medianOfRuns(valid, (r) => r.audits?.["cumulative-layout-shift"]?.numericValue),
      medianScriptBytes: medianOfRuns(valid, scriptBytes),
      // Every valid run's LCP, in collection order, so run-to-run spread is
      // visible in the job log without downloading the artifact.
      medianLcpElement: medianRunLcpElement(valid),
      lcpRunsMs: valid
        .map(({ report }) => lcpMs(report))
        .filter(isMeasured)
        .map((value) => Math.round(value)),
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
  const display = (value, decimals = 0) => (value === null ? "—" : Number(value).toFixed(decimals));
  const rows = summary.pages.map(
    (page) =>
      "| " +
      [
        page.path,
        page.validRuns + "/" + page.expectedRuns,
        display(page.medianPerformanceScore === null ? null : page.medianPerformanceScore * 100),
        display(page.medianLcpMs),
        page.lcpRunsMs.length ? page.lcpRunsMs.join(", ") : "—",
        page.medianLcpElement === null ? "—" : page.medianLcpElement.replaceAll("|", "/"),
        display(page.medianTbtMs),
        display(page.medianCls, 3),
        display(page.medianScriptBytes === null ? null : page.medianScriptBytes / 1024),
        page.status,
      ].join(" | ") +
      " |",
  );
  const sections = [
    "# " + summary.label + " — Lighthouse performance",
    "",
    "Measured " +
      summary.measuredPages +
      "/" +
      summary.expectedPages +
      " pages. Performance scores and numeric metrics are **median of valid runs**.",
    "",
    "| Route | Valid runs | Performance / 100 | LCP ms | LCP per run ms | LCP element (median run) | TBT ms | CLS | JS transfer KiB | Collection |",
    "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |",
    ...rows,
    "",
    "Budget checks are separate from collection: a breached budget does not discard measured reports.",
  ];
  if (summary.technicalErrors.length) {
    sections.push(
      "",
      "## Collection or identity failures",
      "",
      ...summary.technicalErrors.map((message) => "- " + message),
    );
  }
  if (summary.budgetErrors.length) {
    sections.push(
      "",
      "## Budget breaches",
      "",
      ...summary.budgetErrors.map((message) => "- " + message),
    );
  }
  return sections.join("\n") + "\n";
}

function writePerformanceReport(directory, input) {
  const summary = buildPerformanceSummary(input);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  const markdown = markdownReport(summary);
  fs.writeFileSync(path.join(directory, "summary.md"), markdown);
  // Also publish the full table, passing routes included, to the job log and
  // the step summary. Reporting only; nothing here affects collection or budgets.
  if (input.log !== false) {
    process.stdout.write("\n" + markdown + "\n");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
    } catch {
      // The step summary is a convenience; never fail a measurement over it.
    }
  }
  return summary;
}

module.exports = { buildPerformanceSummary, markdownReport, writePerformanceReport };
