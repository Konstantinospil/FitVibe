#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

// Only reports downloaded from the backend/frontend jobs in this CI run are
// acceptable. The workflow downloads artifacts named with github.run_id.
const fs = require("node:fs");
const path = require("node:path");
const { createCoverageMap } = require("istanbul-lib-coverage");

const METRICS = ["lines", "statements", "branches", "functions"];
const WORKSPACES = [
  { name: "backend", directory: "apps/backend/coverage", threshold: "COVERAGE_MIN", defaultMin: 80 },
  { name: "frontend", directory: "apps/frontend/coverage", threshold: "FRONTEND_COVERAGE_MIN", defaultMin: 84 },
];

function minimum(envName, defaultMin) {
  const raw = process.env[envName];
  const value = raw === undefined ? defaultMin : Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Invalid " + envName + " coverage threshold: " + raw);
  }
  return value;
}

function loadReport(directory) {
  const summaryFile = path.join(directory, "coverage-summary.json");
  const finalFile = path.join(directory, "coverage-final.json");
  if (fs.existsSync(summaryFile)) {
    // A corrupt summary must not fall back to another report.
    const report = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
    if (!report || typeof report !== "object" || !report.total) {
      throw new Error(summaryFile + " lacks total coverage");
    }
    return report.total;
  }
  if (fs.existsSync(finalFile)) {
    const map = createCoverageMap(JSON.parse(fs.readFileSync(finalFile, "utf8")));
    return map.getCoverageSummary().data;
  }
  throw new Error("Missing coverage report in " + directory);
}

function metricCounts(report, metric, directory) {
  const item = report[metric];
  if (!item) throw new Error("Missing " + metric + " coverage in " + directory);
  const covered = item.covered;
  const total = item.total;
  if (!Number.isSafeInteger(covered) || !Number.isSafeInteger(total) ||
      total <= 0 || covered < 0 || covered > total) {
    throw new Error("Invalid " + metric + " totals in " + directory);
  }
  return { covered, total };
}

function gate() {
  const combined = Object.fromEntries(METRICS.map((name) => [name, { covered: 0, total: 0 }]));
  let failed = false;

  for (const workspace of WORKSPACES) {
    const directory = path.resolve(workspace.directory);
    const threshold = minimum(workspace.threshold, workspace.defaultMin);
    const report = loadReport(directory);
    console.log("\n" + workspace.name + " coverage (minimum " + threshold + "%):");

    for (const metric of METRICS) {
      const { covered, total } = metricCounts(report, metric, directory);
      const percent = (100 * covered) / total;
      combined[metric].covered += covered;
      combined[metric].total += total;
      const pass = percent + Number.EPSILON >= threshold;
      if (!pass) failed = true;
      console.log("  " + metric + ": " + percent.toFixed(2) + "% (" + covered +
        "/" + total + ")" + (pass ? " PASS" : " FAIL"));
    }
  }

  // The aggregate is a second enforced check, not a substitute for per-workspace checks.
  const aggregateMin = minimum("COVERAGE_MIN", 80);
  console.log("\nCombined coverage (minimum " + aggregateMin + "%):");
  for (const metric of METRICS) {
    const { covered, total } = combined[metric];
    const percent = (100 * covered) / total;
    const pass = percent + Number.EPSILON >= aggregateMin;
    if (!pass) failed = true;
    console.log("  " + metric + ": " + percent.toFixed(2) + "%" +
      (pass ? " PASS" : " FAIL"));
  }

  if (failed) throw new Error("Required coverage thresholds not met");
  console.log("\nAll required coverage metrics met");
}

try {
  gate();
} catch (error) {
  console.error("::error::Coverage gate failed: " + error.message);
  process.exitCode = 1;
}
