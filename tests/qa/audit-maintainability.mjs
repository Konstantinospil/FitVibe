#!/usr/bin/env node
/**
 * Maintainability gate (CI job architecture_hardcoding): hard-coded numbers,
 * duplicated functions, lists and CSS blocks, CSS that re-implements a shared
 * component, fixed grid columns, invalid selectors and literal CSS sizes.
 *
 * Existing findings are recorded per rule and file in
 * tests/qa/baseline/maintainability.json. A file may not get worse; when it gets
 * better the baseline must be lowered so the gain is kept.
 *
 *   node tests/qa/audit-maintainability.mjs                   # check (CI)
 *   node tests/qa/audit-maintainability.mjs --update-baseline # record the current counts
 *   node tests/qa/audit-maintainability.mjs --list <rule>     # every finding of one rule
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  analyzeStylesheets,
  analyzeTypeScript,
  countFindings,
  ratchet,
} from "./maintainability-core.mjs";

const ROOT = process.cwd();
const BASELINE = "tests/qa/baseline/maintainability.json";
const REPORT = "tests/qa/reports/maintainability.json";

const TS_DIRECTORIES = [
  "apps/frontend/src",
  "apps/backoffice/src",
  "apps/backend/src",
  "packages/ui/src",
];
const CSS_DIRECTORIES = ["apps/frontend/src", "apps/backoffice/src", "packages/ui/src"];
const IGNORED =
  /(^|\/)(node_modules|dist|archive|__tests__|__mocks__)(\/|$)|\.(test|spec|stories)\.tsx?$|\.d\.ts$|\/db\/(migrations|seeds)\//;
/** Modules whose job is to hold named values: numbers are expected there. */
const CONSTANT_MODULES = [/\/config\//, /\/constants\//, /\/i18n\//, /tokens\.ts$/];
const COMPONENT_STYLESHEETS = [
  "apps/frontend/src/styles/components.css",
  "packages/ui/src/styles.css",
];
const AUTHORITIES = new Set([
  "apps/frontend/src/styles/tokens.css",
  "apps/frontend/src/styles/themes.css",
  "packages/ui/src/typography.css",
  "apps/backoffice/src/styles/global.css",
]);

async function walk(dir, pattern) {
  const entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (IGNORED.test(relative)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await walk(relative, pattern)));
    } else if (pattern.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

async function read(directories, pattern) {
  const files = (await Promise.all(directories.map((dir) => walk(dir, pattern)))).flat().sort();
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [file, await fs.readFile(path.join(ROOT, file), "utf8")]),
    ),
  );
}

const args = process.argv.slice(2);
const listRule = args.includes("--list") ? args[args.indexOf("--list") + 1] : null;

const findings = [
  ...analyzeTypeScript(await read(TS_DIRECTORIES, /\.tsx?$/), {
    constantModules: CONSTANT_MODULES,
  }),
  ...analyzeStylesheets(await read(CSS_DIRECTORIES, /\.(css|scss)$/), {
    componentStylesheets: COMPONENT_STYLESHEETS,
    authorities: AUTHORITIES,
  }),
];
const counts = countFindings(findings);

await fs.mkdir(path.dirname(path.join(ROOT, REPORT)), { recursive: true });
await fs.writeFile(path.join(ROOT, REPORT), `${JSON.stringify({ counts, findings }, null, 2)}\n`);

if (listRule) {
  for (const item of findings.filter((entry) => entry.rule.startsWith(listRule))) {
    console.log(`${item.file}:${item.line} ${item.rule} ${item.detail}`);
  }
  process.exit(0);
}

if (args.includes("--update-baseline")) {
  await fs.writeFile(path.join(ROOT, BASELINE), `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`Baseline written to ${BASELINE} (${findings.length} findings).`);
  process.exit(0);
}

const baseline = JSON.parse(await fs.readFile(path.join(ROOT, BASELINE), "utf8"));
const { regressions, improvements } = ratchet(counts, baseline);

for (const { rule, file, current, allowed } of regressions) {
  console.log(`::error file=${file}::${rule}: ${current} findings, baseline allows ${allowed}`);
  for (const item of findings.filter((entry) => entry.rule === rule && entry.file === file)) {
    console.log(`  ${item.file}:${item.line} ${item.detail}`);
  }
}
for (const { rule, file, current, allowed } of improvements) {
  console.log(
    `::error file=${file}::${rule}: improved from ${allowed} to ${current}; run "node ${path.relative(ROOT, process.argv[1])} --update-baseline" to keep the gain`,
  );
}

const total = findings.length;
if (regressions.length || improvements.length) {
  console.log(
    `Maintainability gate failed: ${regressions.length} regression(s), ${improvements.length} unrecorded improvement(s). ` +
      "Fix new findings by reusing an existing component, helper or constant; a justified exception needs a " +
      '"maintainability: <rule> -- <reason>" comment.',
  );
  process.exitCode = 1;
} else {
  console.log(
    `Maintainability gate passed: no file got worse (${total} recorded findings remain).`,
  );
}
