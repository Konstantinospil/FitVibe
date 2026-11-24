const fs = require("node:fs");
const path = require("node:path");

const REPORT_DIRECTORY = "security-reports";

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function summarizeOpenSource(report, outcome) {
  if (outcome === "skipped") return { status: "skipped", projects: 0, findings: null };
  const projects = Array.isArray(report) ? report : report ? [report] : [];
  const valid = projects.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      !item.error &&
      (typeof item.ok === "boolean" || Array.isArray(item.vulnerabilities)),
  );
  if (valid.length === 0) {
    return { status: "unavailable", projects: 0, findings: null };
  }
  const findings = valid.reduce(
    (sum, item) => sum + (Array.isArray(item.vulnerabilities) ? item.vulnerabilities.length : 0),
    0,
  );
  const incomplete = valid.length !== projects.length;
  const flagged = valid.some((item) => item.ok === false);
  return {
    status: incomplete
      ? "incomplete"
      : findings > 0
        ? "findings"
        : outcome === "success" && !flagged
          ? "clean"
          : "unavailable",
    projects: valid.length,
    findings,
  };
}

function summarizeCode(report, outcome) {
  if (outcome === "skipped") return { status: "skipped", findings: null };
  if (!report || !Array.isArray(report.runs) || report.runs.length === 0) {
    // A clean Snyk Code scan may not produce JSON; do not infer that an absent report is clean.
    return { status: "unavailable", findings: null };
  }
  if (report.runs.some((run) => !Array.isArray(run.results))) {
    return { status: "unavailable", findings: null };
  }
  const findings = report.runs.reduce((sum, run) => sum + run.results.length, 0);
  return {
    status: findings > 0 ? "findings" : outcome === "success" ? "clean" : "unavailable",
    findings,
  };
}

function main(env = process.env) {
  const directory = path.resolve(REPORT_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  const openSource = summarizeOpenSource(
    readJson(path.join(directory, "snyk-open-source.json")),
    env.SNYK_OPEN_SOURCE_OUTCOME || "skipped",
  );
  const code = summarizeCode(
    readJson(path.join(directory, "snyk-code.sarif")),
    env.SNYK_CODE_OUTCOME || "skipped",
  );
  const status = {
    commit: env.GITHUB_SHA || null,
    openSource: { ...openSource, outcome: env.SNYK_OPEN_SOURCE_OUTCOME || "skipped" },
    code: { ...code, outcome: env.SNYK_CODE_OUTCOME || "skipped" },
  };
  fs.writeFileSync(path.join(directory, "scan-status.json"), JSON.stringify(status, null, 2) + "\n");
  const summary = [
    "### Snyk downloadable reports",
    "",
    `Find the \`snyk-security-${env.GITHUB_RUN_ID || "unknown"}\` artifact in this run's Artifacts section.`,
    "The artifact always includes `scan-status.json`; JSON, SARIF and HTML reports are included when Snyk generated them.",
    "",
    `- Open Source: ${openSource.status} (${openSource.findings ?? "unknown"} findings across ${openSource.projects} projects; action outcome: ${status.openSource.outcome})`,
    `- Code (opt-in via repository variable SNYK_CODE_ENABLED=true): ${code.status} (${code.findings ?? "unknown"} findings; action outcome: ${status.code.outcome})`,
    "- An unavailable or incomplete report is **not** evidence of zero vulnerabilities. Snyk remains advisory; required OSV, pnpm audit, secret scans and Trivy keep their existing gates.",
    "",
  ].join("\n");
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
  if ([openSource.status, code.status].includes("unavailable") || [openSource.status, code.status].includes("incomplete")) {
    process.stdout.write("::warning::A Snyk scan has unavailable or incomplete results; check its CI log and scan-status.json.\n");
  }
  return status;
}

if (require.main === module) main();

module.exports = { summarizeOpenSource, summarizeCode, main };
