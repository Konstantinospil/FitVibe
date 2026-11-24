const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function assertNoExecutableDispatchInterpolation(text) {
  const resolver = text.slice(text.indexOf("- name: Resolve CI run"), text.indexOf("\n  deploy:"));
  assert.ok(resolver.includes("process.env.REQUESTED_CI_RUN_ID"), "manual run ID must be read as process data");
  assert.ok(resolver.includes("Number.isSafeInteger"), "manual run ID requires safe-number validation");
  const code = resolver.split("script: |")[1] || "";
  assert.doesNotMatch(code, /inputs\.ci_run_id/, "manual user input cannot enter generated JavaScript");
}

function assertNonDestructiveBranchAudit(text) {
  assert.match(text, /contents: read/);
  assert.doesNotMatch(text, /deleteRef\s*\(/);
  assert.doesNotMatch(text, /contents: write/);
}

function assertReleaseOrdering(text) {
  const release = text.slice(text.indexOf("\n  publish_release:"));
  assert.match(release, /needs\.build_verification\.result == 'success'/);
  assert.match(release, /needs\.build\.result == 'success'/);
  assert.match(release, /already resolves to a different digest/);
  assert.ok(release.indexOf("Refuse mismatched immutable version tags") < release.indexOf("docker buildx imagetools create -t"));
}

function assertRecoveryBoundary(text) {
  assert.match(text, /trap restore_previous_stack EXIT/);
  assert.match(text, /deployment_switched=1/);
  assert.match(text, /migration_started=1/);
  assert.ok(text.indexOf("migration_started=1") < text.indexOf("migrateAll.js"));
  assert.match(text, /docker inspect --format/);
  assert.match(text, /previous-images\.env/);
}

test("workflow-dispatch data is not executable source", () => {
  const cd = read(".github/workflows/cd.yml");
  assertNoExecutableDispatchInterpolation(cd);
  assert.throws(() => assertNoExecutableDispatchInterpolation(cd.replace("process.env.REQUESTED_CI_RUN_ID", "inputs.ci_run_id")));
});

test("branch audit is read-only and does not delete branches", () => {
  const policy = read(".github/workflows/branch-policy.yml");
  assertNonDestructiveBranchAudit(policy);
  assert.throws(() => assertNonDestructiveBranchAudit(policy.replace("contents: read", "contents: write")));
  assert.throws(() => assertNonDestructiveBranchAudit(policy + "\ngithub.rest.git.deleteRef({});"));
});

test("release promotion requires the verified build and preflight", () => {
  const ci = read(".github/workflows/ci.yml");
  assertReleaseOrdering(ci);
  assert.throws(() => assertReleaseOrdering(ci.replace("needs.build_verification.result == 'success'", "true")));
});

test("failed pre-migration deployments can restore prior images", () => {
  const cd = read(".github/workflows/cd.yml");
  assertRecoveryBoundary(cd);
  assert.throws(() => assertRecoveryBoundary(cd.replace("migration_started=1", "migration_started=0")));
});

test("Snyk scan reports remain downloadable on failures and skipped scans", () => {
  const ci = read(".github/workflows/ci.yml");
  const security = ci.slice(ci.indexOf("\n  security:"), ci.indexOf("\n  codeql_compatibility:"));
  assert.ok(security.includes("--json-file-output=security-reports/snyk-open-source.json"));
  assert.ok(security.includes("name: snyk-security-"));
  assert.ok(security.includes("if-no-files-found: error"));
  assert.ok(security.includes("run: node --test tests/security/snyk-report.test.cjs"));
  assert.ok(security.includes("run: node scripts/security/summarize-snyk-reports.cjs"));
});

function assertPinnedRetryingK6Installer(ci) {
  const performance = ci.slice(ci.indexOf("\n  performance:"), ci.indexOf("\n  pre_main_amd64_smoke:"));
  const install = performance.slice(performance.indexOf("      - name: Install k6"), performance.indexOf("      - name: Wait for PostgreSQL"));
  assert.match(install, /K6_VERSION=2\.3\.0/);
  assert.match(install, /K6_SHA256=[a-f0-9]{64}/);
  assert.match(install, /--retry 8 --retry-all-errors --retry-delay 5/);
  assert.match(install, /--connect-timeout 15 --max-time 120/);
  assert.match(install, /sha256sum --check --status/);
  assert.match(install, /k6 version/);
  assert.doesNotMatch(install, /continue-on-error:/);
  assert.match(performance, /run: k6 run --summary-export=tests\/perf\/k6-summary\.json tests\/perf\/k6-smoke\.js/);
  assert.match(performance, /node tests\/perf\/assert-budgets\.cjs tests\/perf\/k6-summary\.json/);
}

test("k6 installation retries transient failures without bypassing integrity or performance gates", () => {
  const ci = read(".github/workflows/ci.yml");
  assertPinnedRetryingK6Installer(ci);
  assert.throws(() => assertPinnedRetryingK6Installer(ci.replace("--retry-all-errors", "--retry-connrefused")));
  assert.throws(() => assertPinnedRetryingK6Installer(ci.replace("sha256sum --check --status", "true")));
  assert.throws(() => assertPinnedRetryingK6Installer(ci.replace("k6 run --summary-export", "echo k6 run --summary-export")));
});
