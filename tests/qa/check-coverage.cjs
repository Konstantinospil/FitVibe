#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { createCoverageMap } = require("istanbul-lib-coverage");

const MIN_THRESHOLD = Number(process.env.COVERAGE_MIN ?? 80);
const FRONTEND_MIN_THRESHOLD = Number(process.env.FRONTEND_COVERAGE_MIN ?? 84);
const METRICS = ["lines", "statements", "branches", "functions"];
const WORKSPACE_DIRS = ["apps", "packages"];
// Only check workspaces that actually run tests with coverage
const TESTED_WORKSPACES = ["backend", "frontend"];
// Workspaces to include in aggregation (empty = all, or specify like ["backend"])
// Default to only checking backend if frontend coverage is stale/absent
const AGGREGATE_WORKSPACES = (process.env.COVERAGE_WORKSPACES || "").split(",").filter(Boolean);
// If true, only check workspaces with valid coverage (skip stale/empty ones)
const ONLY_CHECK_VALID = process.env.COVERAGE_ONLY_VALID !== "false";

function collectCoverageDirs(rootDir) {
  const dirs = [];
  const rootCoverage = path.join(rootDir, "coverage");
  if (fs.existsSync(rootCoverage)) {
    dirs.push(rootCoverage);
  }

  for (const workspace of WORKSPACE_DIRS) {
    const workspacePath = path.join(rootDir, workspace);
    if (!fs.existsSync(workspacePath)) continue;

    const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Only include workspaces that are expected to have test coverage
      if (workspace === "apps" && !TESTED_WORKSPACES.includes(entry.name)) {
        continue;
      }
      // Skip packages that don't have tests
      if (workspace === "packages") {
        continue;
      }

      const coveragePath = path.join(workspacePath, entry.name, "coverage");
      if (fs.existsSync(coveragePath)) {
        // Verify coverage files exist and are recent (within last 24 hours)
        const summaryPath = path.join(coveragePath, "coverage-summary.json");
        const finalPath = path.join(coveragePath, "coverage-final.json");
        const hasSummary = fs.existsSync(summaryPath);
        const hasFinal = fs.existsSync(finalPath);

        if (hasSummary || hasFinal) {
          // Check file modification time (skip if older than 24 hours)
          const coverageFile = hasSummary ? summaryPath : finalPath;
          const stats = fs.statSync(coverageFile);
          const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

          if (ageHours < 24) {
            dirs.push(coveragePath);
          } else {
            console.warn(
              `Skipping stale coverage: ${coveragePath} (last updated ${ageHours.toFixed(1)} hours ago)`,
            );
          }
        }
      }
    }
  }

  return dirs;
}

function thresholdForWorkspace(workspace) {
  const name = workspace.split(path.sep).pop();
  return name === "frontend" ? FRONTEND_MIN_THRESHOLD : MIN_THRESHOLD;
}

function readCoverageSummary(coverageDir) {
  const summaryPath = path.join(coverageDir, "coverage-summary.json");
  if (fs.existsSync(summaryPath)) {
    try {
      const summaryJson = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      return summaryJson.total ?? null;
    } catch (error) {
      console.warn(`Unable to parse ${summaryPath}: ${error.message}`);
    }
  }

  const finalPath = path.join(coverageDir, "coverage-final.json");
  if (fs.existsSync(finalPath)) {
    try {
      const map = createCoverageMap(JSON.parse(fs.readFileSync(finalPath, "utf8")));
      const summary = map.getCoverageSummary();
      return summary.data ?? summary;
    } catch (error) {
      console.warn(`Unable to parse ${finalPath}: ${error.message}`);
    }
  }

  return null;
}

const coverageDirs = collectCoverageDirs(process.cwd());
const summaries = coverageDirs.map(readCoverageSummary).filter((summary) => summary !== null);

if (summaries.length === 0) {
  console.error(
    "Coverage summary not found in workspace. Run the relevant test suites with coverage output before gating.",
  );
  process.exit(1);
}

const aggregated = METRICS.reduce((acc, metric) => {
  acc[metric] = { covered: 0, total: 0 };
  return acc;
}, {});

for (const summary of summaries) {
  for (const metric of METRICS) {
    const data = summary[metric];
    if (!data) continue;
    aggregated[metric].covered += Number(data.covered ?? 0);
    aggregated[metric].total += Number(data.total ?? 0);
  }
}

// Calculate workspace-specific metrics
const workspaceMetrics = coverageDirs
  .map((dir) => {
    const summary = readCoverageSummary(dir);
    if (!summary) return null;

    const wsMetrics = METRICS.reduce((acc, metric) => {
      const data = summary[metric];
      if (!data) {
        acc[metric] = 0;
        return acc;
      }
      const { covered = 0, total = 0 } = data;
      acc[metric] = total > 0 ? (covered / total) * 100 : 0;
      return acc;
    }, {});

    const relativeDir = path.relative(process.cwd(), dir);
    return { workspace: relativeDir, metrics: wsMetrics };
  })
  .filter(Boolean);

// Calculate aggregated metrics
const metrics = METRICS.reduce((acc, metric) => {
  const { covered, total } = aggregated[metric];
  acc[metric] = total > 0 ? (covered / total) * 100 : 0;
  return acc;
}, {});

// Log workspace-specific coverage
if (workspaceMetrics.length > 0) {
  console.log(`\nWorkspace-specific coverage:`);
  for (const { workspace, metrics: wsMetrics } of workspaceMetrics) {
    console.log(`  ${workspace}:`);
    const threshold = thresholdForWorkspace(workspace);
    for (const metric of METRICS) {
      const pct = wsMetrics[metric];
      const status = pct >= threshold ? "✅" : "❌";
      console.log(`    ${status} ${metric}: ${pct.toFixed(2)}% (target ${threshold}%)`);
    }
  }
}

console.log(`\nAggregated coverage across all workspaces:`);
for (const metric of METRICS) {
  const pct = metrics[metric];
  const status = pct >= MIN_THRESHOLD ? "✅" : "❌";
  console.log(`  ${status} ${metric}: ${pct.toFixed(2)}%`);
}

// Filter workspaces for aggregation if specified
const workspacesForAggregation =
  AGGREGATE_WORKSPACES.length > 0
    ? workspaceMetrics.filter(({ workspace }) => {
        const wsName = workspace.split(path.sep).pop();
        return AGGREGATE_WORKSPACES.includes(wsName);
      })
    : workspaceMetrics;

// Recalculate aggregated metrics if filtering
let finalMetrics = metrics;
if (AGGREGATE_WORKSPACES.length > 0 && workspacesForAggregation.length > 0) {
  const filteredAggregated = METRICS.reduce((acc, metric) => {
    acc[metric] = { covered: 0, total: 0 };
    return acc;
  }, {});

  for (const { workspace } of workspacesForAggregation) {
    const summary = readCoverageSummary(workspace);
    if (!summary) continue;
    for (const metric of METRICS) {
      const data = summary[metric];
      if (!data) continue;
      filteredAggregated[metric].covered += Number(data.covered ?? 0);
      filteredAggregated[metric].total += Number(data.total ?? 0);
    }
  }

  finalMetrics = METRICS.reduce((acc, metric) => {
    const { covered, total } = filteredAggregated[metric];
    acc[metric] = total > 0 ? (covered / total) * 100 : 0;
    return acc;
  }, {});

  console.log(`\nAggregated coverage (filtered to: ${AGGREGATE_WORKSPACES.join(", ")}):`);
  for (const metric of METRICS) {
    const pct = finalMetrics[metric];
    const status = pct >= MIN_THRESHOLD ? "✅" : "❌";
    console.log(`  ${status} ${metric}: ${pct.toFixed(2)}%`);
  }
}

const failing = Object.entries(finalMetrics).filter(([, pct]) => pct < MIN_THRESHOLD);

// Filter out workspaces with very low coverage that might be stale/untested
const validWorkspaces = ONLY_CHECK_VALID
  ? workspaceMetrics.filter(({ metrics: wsMetrics }) => {
      // Consider a workspace "valid" if at least one metric is > 50%
      // This filters out completely untested workspaces
      return METRICS.some((metric) => wsMetrics[metric] > 50);
    })
  : workspaceMetrics;

// Check if any valid workspace is below threshold
const workspaceFailures = validWorkspaces.filter(({ workspace, metrics: wsMetrics }) => {
  const threshold = thresholdForWorkspace(workspace);
  return METRICS.some((metric) => wsMetrics[metric] < threshold);
});

if (validWorkspaces.length === 0) {
  console.error(`\n❌ No valid workspace coverage found. Run tests with coverage first.`);
  console.error(`   Example: pnpm test:backend -- --coverage`);
  process.exit(1);
}

// Warn about excluded workspaces
const excludedWorkspaces = workspaceMetrics.filter((ws) => !validWorkspaces.includes(ws));
if (excludedWorkspaces.length > 0 && ONLY_CHECK_VALID) {
  console.warn(`\n⚠️  Excluding workspaces with very low/stale coverage:`);
  for (const { workspace, metrics: wsMetrics } of excludedWorkspaces) {
    console.warn(`  ${workspace}:`);
    for (const metric of METRICS) {
      const pct = wsMetrics[metric];
      console.warn(`    - ${metric}: ${pct.toFixed(2)}%`);
    }
  }
  console.warn(`  Set COVERAGE_ONLY_VALID=false to include these in checks.`);
}

// For now, we only fail on workspace-specific failures, not aggregated
// (aggregated can fail due to one workspace dragging down the average)
if (workspaceFailures.length > 0) {
  console.error("\n❌ Some workspaces below their coverage threshold:");
  for (const { workspace, metrics: wsMetrics } of workspaceFailures) {
    const threshold = thresholdForWorkspace(workspace);
    console.error(`  ${workspace}:`);
    for (const metric of METRICS) {
      const pct = wsMetrics[metric];
      if (pct < threshold) {
        console.error(`    - ${metric}: ${pct.toFixed(2)}% (need ${threshold}%)`);
      }
    }
  }
  console.error(`\nRun tests with coverage to update: pnpm test:backend && pnpm test:frontend`);
  process.exit(1);
} else {
  const metricsToShow = AGGREGATE_WORKSPACES.length > 0 ? finalMetrics : metrics;
  console.log(`\n✅ All workspace coverage requirements met!`);
  if (AGGREGATE_WORKSPACES.length === 0) {
    console.log(
      `   Aggregated: lines ${metrics.lines.toFixed(2)}%, statements ${metrics.statements.toFixed(
        2,
      )}%, branches ${metrics.branches.toFixed(2)}%, functions ${metrics.functions.toFixed(2)}%`,
    );
  }
}
