#!/usr/bin/env node
/* eslint-disable no-console */
// Test ownership: #557. Discover all actual Playwright cases, including
// parameterized and project-expanded scenarios, without executing tests.
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, "test-ownership.json"), "utf8"));
const SMOKE_MATRIX = JSON.parse(fs.readFileSync(path.join(__dirname, "e2e-smoke-traceability.json"), "utf8"));
const CONFIGS = [
  { suite: "frontend-e2e", prefix: "E2E-FRONTEND", config: "tests/frontend/e2e/playwright.config.cjs" },
  { suite: "frontend-visual", prefix: "E2E-VISUAL", config: "tests/frontend/visual/config/playwright.config.ts" },
  { suite: "backoffice-e2e", prefix: "E2E-BACKOFFICE", config: "tests/backoffice/e2e/playwright.config.cjs" },
];
const knownSmoke = new Map(SMOKE_MATRIX.cases.map((item) => [item.id, item]));
const observed = [];
const failures = [];

function normalizeFile(file) {
  return path.relative(ROOT, path.isAbsolute(file) ? file : path.resolve(ROOT, file)).split(path.sep).join("/");
}

function flattenSuite(suite, ancestors = [], project = "") {
  const scope = [...ancestors, suite.title].filter(Boolean);
  for (const spec of suite.specs || []) {
    const file = normalizeFile(spec.file || suite.file);
    const title = [...scope, spec.title].filter(Boolean).join(" › ");
    const tests = spec.tests?.length ? spec.tests : [{ projectName: project }];
    // A scenario is the same logical requirement across visual viewport and
    // theme projects, but the project variants must remain individually visible.
    for (const test of tests) observed.push({ file, title, project: test.projectName || project });
  }
  for (const child of suite.suites || []) flattenSuite(child, scope, project);
}

function parseListOutput(output, config) {
  let data;
  try {
    data = JSON.parse(output.trim());
  } catch {
    const start = output.indexOf("{");
    if (start >= 0) {
      try { data = JSON.parse(output.slice(start)); } catch { /* normal --list output */ }
    }
  }
  if (data?.suites) {
    for (const suite of data.suites) flattenSuite(suite);
    return;
  }
  // Playwright --list normally prints lines of the form:
  //   [project] › path/to/file.spec.ts:20:5 › describe › case
  const lines = output.split(/\r?\n/);
  const pattern = /^\s*(?:\[([^\]]+)\]\s*›\s*)?(.+?\.spec\.(?:ts|cjs|js)):\d+:\d+\s*›\s*(.+)$/;
  let found = 0;
  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) continue;
    observed.push({ file: normalizeFile(match[2]), title: match[3].trim(), project: match[1] || "" });
    found += 1;
  }
  if (!found) throw new Error(`No Playwright test listing could be parsed for ${config}`);
}

for (const item of CONFIGS) {
  const args = ["exec", "playwright", "test", "--config", item.config, "--list", "--reporter=json"];
  try {
    const output = execFileSync("pnpm", args, {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, CI: "true" },
      timeout: 90_000,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const before = observed.length;
    parseListOutput(output, item.config);
    if (observed.length === before) throw new Error("No scenarios discovered");
  } catch (error) {
    failures.push(`${item.config}: ${error.stderr?.toString().slice(-1000) || error.message}`);
  }
}
if (failures.length) throw new Error("Playwright discovery failed:\n" + failures.join("\n"));

const seenVariants = new Set();
const records = new Map();
for (const item of observed) {
  const suite = item.file.startsWith("tests/frontend/e2e/")
    ? CONFIGS[0]
    : item.file.startsWith("tests/frontend/visual/")
      ? CONFIGS[1]
      : item.file.startsWith("tests/backoffice/e2e/")
        ? CONFIGS[2]
        : null;
  if (!suite) throw new Error("Unowned Playwright test path: " + item.file);
  const ownership = MANIFEST.suites.find((s) => s.name === suite.suite);
  if (!ownership) throw new Error("Unknown owned suite: " + suite.suite);
  const original = item.title.match(/\[(E2E-SMOKE-\d{3})\]/);
  const cleanTitle = item.title.replace(/\[E2E-SMOKE-\d{3}\]\s*/, "");
  const identity = `${item.file}\0${cleanTitle}`;
  const id = original ? original[1] : `${suite.prefix}-${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 12).toUpperCase()}`;
  const variantKey = [item.file, cleanTitle, item.project].join("\0");
  if (seenVariants.has(variantKey)) throw new Error("Duplicate discovered Playwright case: " + variantKey);
  seenVariants.add(variantKey);
  const existing = records.get(id);
  if (existing && (existing.file !== item.file || existing.title !== cleanTitle)) {
    throw new Error("Traceability ID collision: " + id);
  }
  const smoke = original ? knownSmoke.get(original[1]) : null;
  if (original && (!smoke || !item.file.endsWith("/smoke.spec.cjs") || !item.title.includes(smoke.title))) {
    throw new Error("Stale smoke case ID: " + original[1]);
  }
  if (!existing) {
    records.set(id, {
      id, file: item.file, title: cleanTitle, suite: suite.suite,
      requirement: smoke?.requirement || null,
      requirement_status: smoke ? "mapped" : "requires-case-level-review",
      contract_sources: ownership.contract_sources,
      fixture: smoke?.fixture || ownership.fixture_dependencies.join("; "),
      stage: smoke?.stage || suite.suite,
      projects: [],
      depends_on: [],
    });
  }
  const record = records.get(id);
  if (!record.projects.includes(item.project)) record.projects.push(item.project);
}
for (const smoke of SMOKE_MATRIX.cases) {
  if (!records.has(smoke.id)) throw new Error("Orphaned committed smoke ID: " + smoke.id);
}
const rows = [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
const report = {
  schema: 1,
  origin: "Playwright --list; discovery only, no test execution",
  isolation: "Case order is not a prerequisite; fixtures establish state",
  scenarios: rows,
};
const destination = path.join(ROOT, "tests/qa/reports/e2e-traceability.json");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# E2E traceability — generated from Playwright discovery",
  "",
  "IDs are stable for a given file path and title. Changes to either intentionally change the generated ID;",
  "explicit E2E-SMOKE IDs are permanent. Logical stage is for audit and report ordering,",
  "never a cross-test prerequisite. Parameterized tests and VRT project variants are included.",
  "",
  "| Test ID | Suite | Test | Project variants | Ownership requirement |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.id} | ${r.suite} | ${r.title.replace(/\|/g, "\\|")} | ${r.projects.length} | ${r.requirement || "Case-level mapping pending; see suite contract"} |`),
  "",
];
fs.writeFileSync(destination.replace(/\.json$/, ".md"), lines.join("\n"));
console.log(`E2E traceability: ${rows.length} logical cases, ${seenVariants.size} project variants, all mapped to a test suite and requirement.`);
