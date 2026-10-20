#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
const section = workspace.split(/^overrides:\s*$/m)[1];
if (!section) throw new Error("Missing pnpm workspace overrides");
const overrides = [...section.matchAll(/^  ('[^']+'|[^:#\s]+):\s+(.+)$/gm)]
  .map(m => [m[1].replace(/^'|'$/g, ""), m[2].trim().replace(/^'|'$/g, "")]);
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs/dependency-overrides.json"), "utf8"));
const records = inventory.overrides;
const errors = [];
const actual = new Map(overrides);
const documented = new Map();
for (const item of records) {
  if (documented.has(item.name)) errors.push("Duplicate inventory entry: " + item.name);
  documented.set(item.name, item);
  if (!item.reason || !item.removalCriteria || !item.status) errors.push("Incomplete documentation: " + item.name);
}
for (const [name, value] of actual) {
  if (!documented.has(name)) errors.push("Undocumented override: " + name);
  else if (documented.get(name).constraint !== value) errors.push("Constraint changed without inventory update: " + name);
}
for (const name of documented.keys()) if (!actual.has(name)) errors.push("Stale inventory entry: " + name);
// Fail closed on undocumented direct-dependency version contradictions.
// Known historical exceptions must be explicitly marked for compatibility review.
const manifests = ["package.json", "apps/frontend/package.json", "apps/backoffice/package.json", "apps/backend/package.json", "packages/ui/package.json"];
function parseVersion(range) {
  const match = /^(\\^|~|>=|>|=)?(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(range);
  return match && { op: match[1] || "=", major: Number(match[2]), minor: Number(match[3]), patch: Number(match[4]) };
}
function contradicts(exactValue, requested) {
  const resolved = parseVersion(exactValue), wanted = parseVersion(requested);
  if (!resolved || !wanted || resolved.op !== "=") return false;
  const cmp = (resolved.major-wanted.major) || (resolved.minor-wanted.minor) || (resolved.patch-wanted.patch);
  if (wanted.op === "=") return cmp !== 0;
  if (wanted.op === "^") return cmp < 0 || resolved.major !== wanted.major;
  if (wanted.op === "~") return cmp < 0 || resolved.major !== wanted.major || resolved.minor !== wanted.minor;
  if (wanted.op === ">=") return cmp < 0;
  if (wanted.op === ">") return cmp <= 0;
  return false;
}
for (const file of manifests) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) continue;
  const manifest = JSON.parse(fs.readFileSync(absolute, "utf8"));
  for (const [name, requested] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (!actual.has(name) || !contradicts(actual.get(name), requested)) continue;
    const item = documented.get(name);
    const recorded = item?.directDeclarations?.some(d => d.manifest === file && d.range === requested);
    if (!item || item.status !== "requires-compatibility-review" || !item.reason || !item.removalCriteria || !recorded) {
      errors.push(file + ": " + name + " override " + actual.get(name) + " conflicts with " + requested + " without documented review");
    } else {
      console.warn("Known override discrepancy: " + file + " " + name + " requested " + requested + " forced " + actual.get(name));
    }
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Verified " + actual.size + " documented overrides against pnpm-workspace.yaml");
