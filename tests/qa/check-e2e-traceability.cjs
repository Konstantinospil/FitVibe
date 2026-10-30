#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, "e2e-smoke-traceability.json"), "utf8"));
const source = fs.readFileSync(path.join(root, matrix.scope), "utf8");
const discovered = [...source.matchAll(/test\("\[([A-Z0-9-]+)\] ([^"]+)",\s*async/g)]
  .map((match) => ({ id: match[1], title: match[2] }));
const allTests = [...source.matchAll(/\btest\("/g)].length;
function fail(message) {
  throw new Error("E2E traceability: " + message);
}
if (matrix.version !== 1 || !Array.isArray(matrix.cases)) fail("unsupported or missing matrix");
if (allTests !== discovered.length) fail("each smoke test must declare a stable [E2E-SMOKE-NNN] ID");
const IDs = new Set();
const titles = new Set();
for (const entry of matrix.cases) {
  if (!/^E2E-SMOKE-\d{3}$/.test(entry.id)) fail("invalid ID: " + entry.id);
  if (IDs.has(entry.id)) fail("duplicate matrix ID: " + entry.id);
  IDs.add(entry.id);
  if (!entry.title || !entry.requirement || !entry.stage || !entry.fixture) fail("incomplete matrix entry: " + entry.id);
  if (!Object.hasOwn(matrix.prerequisite_contracts, entry.fixture)) fail("unknown fixture contract: " + entry.id);
  if (!Array.isArray(entry.depends_on) || entry.depends_on.length) {
    fail("cross-test dependencies are prohibited; move prerequisites into fixtures: " + entry.id);
  }
  titles.add(entry.title);
}
if (new Set(discovered.map((entry) => entry.id)).size !== discovered.length) fail("duplicate IDs in test source");
if (discovered.length !== matrix.cases.length) fail("test count and matrix count differ");
for (const item of discovered) {
  const record = matrix.cases.find((entry) => entry.id === item.id);
  if (!record || record.title !== item.title) fail("missing or stale matrix mapping: " + item.id);
}
console.log("E2E traceability: " + discovered.length + " smoke scenarios mapped with stable IDs and independent fixture contracts.");
