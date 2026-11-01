/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const metricsFile = path.resolve(process.cwd(), "apps/backend/src/observability/metrics.ts");

const alertRulesFile = path.resolve(process.cwd(), "infra/observability/alert-rules.yml");
const alertmanagerFile = path.resolve(process.cwd(), "infra/observability/alertmanager.yml");
const prometheusFile = path.resolve(process.cwd(), "infra/observability/prometheus.yml");

const REQUIRED_METRICS = ["http_request_duration_seconds", "http_requests_total"];

const REQUIRED_LABELS = ["method", "route", "status_code"];
const REQUIRED_BUCKETS = ["0.05", "0.1", "0.2", "0.5", "1", "2", "5"];

function fileContainsAll(haystack, needles) {
  return needles.every((needle) => haystack.includes(needle));
}

function main() {
  const contents = fs.readFileSync(metricsFile, "utf8");

  for (const metric of REQUIRED_METRICS) {
    if (!contents.includes(`"${metric}"`)) {
      console.error(`Missing Prometheus metric "${metric}" in metrics middleware.`);
      process.exit(1);
    }
  }

  if (
    !fileContainsAll(
      contents,
      REQUIRED_LABELS.map((l) => `"${l}"`),
    )
  ) {
    console.error("Metrics middleware must expose labels method, route, status_code.");
    process.exit(1);
  }

  if (
    !fileContainsAll(
      contents,
      REQUIRED_BUCKETS.map((b) => `${b}`),
    )
  ) {
    console.error("Histogram buckets must include 0.05, 0.1, 0.2, 0.5, 1, 2, 5 seconds.");
    process.exit(1);
  }

  // #557: only rules included in the active Prometheus configuration count.
  const rules = fs.readFileSync(alertRulesFile, "utf8");
  const manager = fs.readFileSync(alertmanagerFile, "utf8");
  const prometheus = fs.readFileSync(prometheusFile, "utf8");
  for (const metric of ["auth_failed_login_total", "auth_password_reset_total"]) {
    if (!contents.includes(`"${metric}"`) || !rules.includes(metric)) {
      console.error(`Missing emitted metric or active security alert reference: ${metric}`);
      process.exit(1);
    }
  }
  for (const alert of ["FailedLoginSpike", "PasswordResetTokenFailureRate"]) {
    if (!rules.includes(`- alert: ${alert}`)) {
      console.error(`Missing authentication policy alert: ${alert}`);
      process.exit(1);
    }
  }
  if (!rules.includes("[30d:5m]") || !rules.includes(">= 8000")) {
    console.error("30-day anomaly detection must retain its baseline sample guard.");
    process.exit(1);
  }
  if (!prometheus.includes("alert-rules.yml") || !prometheus.includes("alertmanager:9093")) {
    console.error("Prometheus must load alert rules and connect to Alertmanager.");
    process.exit(1);
  }
  if (!manager.includes("component: security") || !manager.includes("category: security")) {
    console.error("Alertmanager must route both security label contracts.");
    process.exit(1);
  }

  console.log("Prometheus metrics contract verified.");
}

main();
