"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.resolve(__dirname, "check-coverage.cjs");
const metrics = ["lines", "statements", "branches", "functions"];

function report(covered, total = 100) {
  return {
    total: Object.fromEntries(
      metrics.map((metric) => [metric, { covered, total, skipped: 0, pct: (100 * covered) / total }]),
    ),
  };
}

function fixture(t, backend = report(80), frontend = report(84)) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-coverage-gate-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [name, data] of [["backend", backend], ["frontend", frontend]]) {
    if (data === null) continue;
    const coverageDir = path.join(directory, "apps", name, "coverage");
    fs.mkdirSync(coverageDir, { recursive: true });
    fs.writeFileSync(path.join(coverageDir, "coverage-summary.json"),
      typeof data === "string" ? data : JSON.stringify(data));
  }
  return directory;
}

function run(cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, COVERAGE_MIN: "80", FRONTEND_COVERAGE_MIN: "84", ...extraEnv },
    encoding: "utf8",
  });
}

test("accepts both required workspaces when all metrics pass", (t) => {
  const result = run(fixture(t));
  assert.equal(result.status, 0, result.stderr);
});

test("fails if frontend coverage is missing", (t) => {
  const result = run(fixture(t, report(85), null));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing coverage report/);
});

test("fails if backend coverage is missing", (t) => {
  const result = run(fixture(t, null, report(90)));
  assert.notEqual(result.status, 0);
});

test("fails on corrupt coverage rather than falling back", (t) => {
  const result = run(fixture(t, report(90), "{invalid"));
  assert.notEqual(result.status, 0);
});

test("fails on zero measured statements", (t) => {
  const invalid = report(90);
  invalid.total.statements = { covered: 0, total: 0, pct: 100 };
  const result = run(fixture(t, report(90), invalid));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid statements totals/);
});

test("never excludes a workspace at or below 50 percent", (t) => {
  const result = run(fixture(t, report(90), report(30)));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required coverage thresholds not met/);
});

test("enforces frontend's 84 percent threshold separately", (t) => {
  const result = run(fixture(t, report(90), report(83)));
  assert.notEqual(result.status, 0);
});

test("enforces aggregate coverage even when individual limits are loosened", (t) => {
  const result = run(fixture(t, report(80), report(20)), { FRONTEND_COVERAGE_MIN: "20" });
  assert.notEqual(result.status, 0);
});

test("rejects invalid threshold configuration", (t) => {
  const result = run(fixture(t), { FRONTEND_COVERAGE_MIN: "not-a-number" });
  assert.notEqual(result.status, 0);
});
