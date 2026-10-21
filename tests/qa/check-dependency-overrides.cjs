#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.DEPENDENCY_AUDIT_ROOT ? path.resolve(process.env.DEPENDENCY_AUDIT_ROOT) : path.resolve(__dirname, "../..");
const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
const section = workspace.split(/^overrides:\s*$/m)[1];
if (!section) throw new Error("Missing pnpm workspace overrides");
const overrides = [...section.matchAll(/^  ('[^']+'|[^:#\s]+):\s+(.+)$/gm)]
  .map(m => [m[1].replace(/^'|'$/g, ""), m[2].trim().replace(/^'|'$/g, "")]);
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs/dependency-overrides.json"), "utf8"));
const records = inventory.overrides;
// pnpm 12 workspace settings are authoritative. Additional package.json override
// sources would silently bypass this inventory and can mislead maintainers.
const rootManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const errors = [];
if (rootManifest.overrides && Object.keys(rootManifest.overrides).length) {
  errors.push("Root package.json overrides are forbidden: use pnpm-workspace.yaml and docs/dependency-overrides.json");
}
if (rootManifest.pnpm?.overrides && Object.keys(rootManifest.pnpm.overrides).length) {
  errors.push("Root package.json pnpm.overrides are forbidden: use pnpm-workspace.yaml");
}
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
// A recorded but unverified reason is not evidence that a constraint is needed.
// Keep existing technical debt visible while requiring substantive reasons when
// marking an item reviewed.
const pending = records.filter(item => item.status === "unverified-necessity");
for (const item of records) {
  if (item.status !== "unverified-necessity" &&
      /historical constraint; originating issue\/advisory has not yet been verified/i.test(item.reason || "")) {
    errors.push("Reviewed override lacks evidence-based justification: " + item.name);
  }
}
if (pending.length) {
  console.warn("Dependency override review outstanding: " + pending.length + " of " + records.length +
    " overrides are inventoried but not justified; see docs/dependency-overrides.json");
}
// Fail closed on undocumented direct-dependency version contradictions.
// Known historical exceptions must be explicitly marked for compatibility review.
const manifests = ["package.json"];
for (const area of ["apps", "packages"]) {
  const dir = path.join(root, area);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const file = path.posix.join(area, entry.name, "package.json");
      if (fs.existsSync(path.join(root, file))) manifests.push(file);
    }
  }
}
function parseVersion(range) {
  const match = /^(\^|~|>=|>|=)?(\d+)\.(\d+)\.(\d+)$/.exec(range);
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
