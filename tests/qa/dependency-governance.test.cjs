#!/usr/bin/env node
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
function report(name) {
  return JSON.parse(execFileSync(process.execPath, [path.join(root,"tests/qa",name)], {cwd:root,encoding:"utf8"}));
}
test("relevance report recognizes resolved transitive packages", () => {
  const r = report("report-dependency-relevance.cjs");
  assert.ok(r.checkedOverrides > 0);
  for(const name of ["follow-redirects","lodash","ws","fast-xml-parser"])
    assert.ok(!r.findings.some(f=>f.name===name),name+" incorrectly classified as absent");
});
test("source report respects declared TypeScript path aliases", () => {
  const r = report("analyze-source-dependencies.cjs");
  for(const workspace of r.workspaces)
    for(const item of workspace.undeclared)
      assert.ok(!["@fitvibe/types","@fitvibe/contracts"].includes(item.name),workspace.workspace+" alias incorrectly flagged: "+item.name);
});
