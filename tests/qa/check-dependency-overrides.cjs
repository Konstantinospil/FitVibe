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
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("Verified " + actual.size + " documented overrides against pnpm-workspace.yaml");
