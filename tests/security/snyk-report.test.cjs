const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { summarizeOpenSource, summarizeCode, main } = require("../../scripts/security/summarize-snyk-reports.cjs");

test("Snyk Open Source reports findings even when action fails on vulnerabilities", () => {
  const report = [
    { ok: false, vulnerabilities: [{ severity: "high" }, { severity: "low" }] },
    { ok: true, vulnerabilities: [] },
  ];
  assert.deepEqual(summarizeOpenSource(report, "failure"), {
    status: "findings",
    projects: 2,
    findings: 2,
  });
});

test("Snyk Open Source distinguishes clean, missing, malformed and partial results", () => {
  assert.equal(summarizeOpenSource({ ok: true, vulnerabilities: [] }, "success").status, "clean");
  assert.equal(summarizeOpenSource(null, "failure").status, "unavailable");
  assert.equal(summarizeOpenSource({ error: "scan quota exhausted" }, "failure").status, "unavailable");
  assert.equal(summarizeOpenSource({ ok: false, vulnerabilities: [] }, "failure").status, "unavailable");
  assert.equal(
    summarizeOpenSource([{ ok: false, vulnerabilities: [{ severity: "high" }] }, { error: "failure" }], "failure").status,
    "incomplete",
  );
  assert.equal(summarizeOpenSource(null, "skipped").status, "skipped");
});

test("Snyk Code reports findings and never calls an absent SARIF clean", () => {
  assert.equal(summarizeCode({ runs: [{ results: [{ ruleId: "example" }] }] }, "failure").status, "findings");
  assert.equal(summarizeCode({ runs: [{ results: [] }] }, "success").status, "clean");
  assert.equal(summarizeCode(null, "success").status, "unavailable");
  assert.equal(summarizeCode({ runs: [{}] }, "failure").status, "unavailable");
  assert.equal(summarizeCode(null, "skipped").status, "skipped");
});

test("metadata artifact is always created without a token or reports", () => {
  const oldCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-snyk-report-"));
  try {
    process.chdir(directory);
    const result = main({ GITHUB_SHA: "test-sha", SNYK_OPEN_SOURCE_OUTCOME: "skipped", SNYK_CODE_OUTCOME: "skipped" });
    const file = path.join(directory, "security-reports/scan-status.json");
    assert.ok(fs.existsSync(file));
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), result);
    assert.equal(result.openSource.status, "skipped");
  } finally {
    process.chdir(oldCwd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
