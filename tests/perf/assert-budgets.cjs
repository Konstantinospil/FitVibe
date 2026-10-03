/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const summaryPath = process.argv[2];

if (!summaryPath) {
  console.error("Usage: node tests/perf/assert-budgets.cjs <summary.json>");
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), summaryPath);

if (!fs.existsSync(resolved)) {
  console.error(`k6 summary not found at ${resolved}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(resolved, "utf8"));

const readP95 = (metric) => {
  const sources = [metric?.values, metric?.percentiles, metric];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const raw =
      source["p(95)"] ??
      source["95"] ??
      source["95%"] ??
      source["p95"] ??
      source["P(95)"] ??
      source["95.0"] ??
      source["95.00"] ??
      null;
    if (raw !== null && raw !== undefined) {
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        return value;
      }
    }
  }
  return null;
};

const readRate = (metric) => {
  const sources = [metric, metric?.values];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    if (typeof source.rate === "number") {
      return source.rate;
    }
    if (typeof source.value === "number") {
      return source.value;
    }
  }
  if (typeof metric?.fails === "number" && typeof metric?.passes === "number") {
    const total = metric.fails + metric.passes;
    if (total > 0) {
      return metric.fails / total;
    }
  }
  return null;
};

const interpretThresholdRecord = (record) => {
  if (typeof record === "boolean") {
    return record === false;
  }
  if (typeof record === "string") {
    const normalized = record.toLowerCase();
    if (normalized === "pass" || normalized === "passed" || normalized === "false") {
      return true;
    }
    if (normalized === "fail" || normalized === "failed" || normalized === "true") {
      return false;
    }
  }
  if (typeof record === "number") {
    if (record === 0) return true;
    if (record === 1) return false;
  }
  if (record && typeof record === "object") {
    const ok =
      record.ok ??
      record.success ??
      record.pass ??
      (typeof record.status === "string" ? record.status.toLowerCase() === "pass" : undefined);
    if (ok !== undefined) {
      return ok === true || ok === "true";
    }
  }
  return null;
};

function ensureThreshold(metricName, threshold) {
  const metric = summary.metrics?.[metricName];
  if (!metric) {
    console.error(`Missing metric "${metricName}" in k6 summary.`);
    process.exit(1);
  }

  if (metric.thresholds && Object.prototype.hasOwnProperty.call(metric.thresholds, threshold)) {
    const thresholdRecord = metric.thresholds[threshold];
    const interpreted = interpretThresholdRecord(thresholdRecord);
    if (interpreted === true) {
      return;
    }
    if (interpreted === false) {
      const actual =
        (thresholdRecord && typeof thresholdRecord === "object"
          ? (thresholdRecord.actual ?? thresholdRecord.value)
          : null) ?? "(see k6 output)";
      console.error(
        `Threshold "${threshold}" for metric "${metricName}" breached. Actual: ${actual}`,
      );
      process.exit(1);
    }
    // Unknown structure: fall back to manual verification below.
  }

  const p95Match = threshold.match(/^p\(95\)<(\d+(?:\.\d+)?)$/);
  if (p95Match) {
    const limit = Number(p95Match[1]);
    const actual = readP95(metric);
    if (actual === null || Number.isNaN(actual)) {
      console.error(
        `Missing threshold "${threshold}" for metric "${metricName}" and unable to compute p95 fallback.`,
      );
      process.exit(1);
    }
    if (actual >= limit) {
      console.error(
        `Metric "${metricName}" p95 of ${actual.toFixed(2)}ms breaches fallback limit ${limit}ms.`,
      );
      process.exit(1);
    }
    console.warn(
      `Metric "${metricName}" missing threshold "${threshold}". Verified manually: p95=${actual.toFixed(
        2,
      )}ms < ${limit}ms`,
    );
    return;
  }

  const rateMatch = threshold.match(/^rate<(\d+(?:\.\d+)?)$/);
  if (rateMatch) {
    const limit = Number(rateMatch[1]);
    const actual = readRate(metric);
    if (actual === null || Number.isNaN(actual)) {
      console.error(
        `Missing threshold "${threshold}" for metric "${metricName}" and unable to compute rate fallback.`,
      );
      process.exit(1);
    }
    if (actual >= limit) {
      console.error(`Metric "${metricName}" rate of ${actual} breaches fallback limit ${limit}.`);
      process.exit(1);
    }
    console.warn(
      `Metric "${metricName}" missing threshold "${threshold}". Verified manually: rate=${actual} < ${limit}`,
    );
    return;
  }

  console.error(`Missing threshold "${threshold}" for metric "${metricName}".`);
  process.exit(1);
}

ensureThreshold("http_req_duration", "p(95)<300");
ensureThreshold("http_req_failed", "rate<0.01");
ensureThreshold("http_req_duration_health", "p(95)<200");
ensureThreshold("http_req_duration_governance", "p(95)<250");
ensureThreshold("http_req_duration_exercise_types", "p(95)<300");
ensureThreshold("http_req_duration_translations", "p(95)<300");

const baselinePath = path.resolve("tests/perf/baseline/p95-benchmark.json");
if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  for (const [metricName, baselineValue] of Object.entries(baseline)) {
    const metric = summary.metrics?.[metricName];
    if (!metric) {
      console.error(`Baseline references missing metric "${metricName}".`);
      process.exit(1);
    }
    const actual = readP95(metric);
    if (actual === null || Number.isNaN(actual)) {
      console.error(`Unable to read p95 for metric "${metricName}".`);
      process.exit(1);
    }
    const allowed = baselineValue * 1.1;
    if (actual > allowed) {
      console.error(
        `Regression detected on ${metricName}: p95=${actual.toFixed(
          2,
        )}ms, baseline=${baselineValue}ms (limit ${allowed.toFixed(2)}ms)`,
      );
      process.exit(1);
    }
    console.log(
      `Metric ${metricName}: p95=${actual.toFixed(2)}ms (baseline ${baselineValue}ms, allowed ${allowed.toFixed(
        2,
      )}ms)`,
    );
  }
} else {
  console.warn(`No calibrated real-stack regression baseline at ${baselinePath}; absolute endpoint budgets remain enforced.`);
}

console.log("k6 performance budgets satisfied.");
