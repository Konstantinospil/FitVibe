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
  assert.ok(release.indexOf("Refuse mismatched immutable version tags") < release.indexOf("Promote verified digests to version tags"));
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
