#!/usr/bin/env node
const test = require("node:test");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const script = path.join(__dirname, "report-override-impact.cjs");

function withFixture(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "override-impact-"));
  try {
    fs.mkdirSync(path.join(dir, "docs"), {recursive:true});
    fs.mkdirSync(path.join(dir, "apps", "web"), {recursive:true});
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({name:"fixture", private:true}));
    fs.writeFileSync(path.join(dir, "apps", "web", "package.json"), JSON.stringify({dependencies:{"direct-pkg":"^1.0.0"}}));
    fs.writeFileSync(path.join(dir, "docs", "dependency-overrides.json"), JSON.stringify({overrides:[
      {name:"direct-pkg",status:"unverified-necessity"},
      {name:"transitive-pkg",status:"unverified-necessity"},
      {name:"absent-pkg",status:"unverified-necessity"}
    ]}));
    fs.writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\noverrides:\n  direct-pkg: 1.2.3\n  transitive-pkg: 2.3.4\n  absent-pkg: 9.9.9\n");
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\npackages:\n  direct-pkg@1.2.3:\n    resolution: {}\nsnapshots:\n  direct-pkg@1.2.3: {}\n  transitive-pkg@2.3.4(peer@1.0.0): {}\n");
    return run(dir);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
function generate(dir) {
  return JSON.parse(execFileSync(process.execPath,[script],{
    encoding:"utf8",env:{...process.env,DEPENDENCY_AUDIT_ROOT:dir}
  }));
}
test("report captures package and peer snapshot resolutions without declaring overrides safe", () => withFixture(dir => {
  const output=generate(dir);
  assert.equal(output.schemaVersion,1);
  assert.equal(output.advisoryOnly,true);
  assert.equal(output.totals.overrides,3);
  assert.equal(output.totals.demonstratedSafeToRemove,0);
  const byName=Object.fromEntries(output.entries.map(e=>[e.name,e]));
  assert.deepEqual(byName["direct-pkg"].resolvedVersions,["1.2.3"]);
  assert.equal(byName["direct-pkg"].classification,"direct-and-transitive-review");
  assert.equal(byName["direct-pkg"].directDeclarations[0].requested,"^1.0.0");
  assert.deepEqual(byName["transitive-pkg"].resolvedVersions,["2.3.4"]);
  assert.equal(byName["transitive-pkg"].classification,"transitive-review");
  assert.deepEqual(byName["absent-pkg"].resolvedVersions,[]);
  assert.equal(byName["absent-pkg"].classification,"not-found-in-lockfile-review");
  for(const entry of output.entries) {
    assert.equal(entry.overrideEffect,"not-determined");
    assert.equal(entry.safeToRemove,false);
  }
}));
test("report fails when an override is not included in the inventory", () => withFixture(dir => {
  fs.appendFileSync(path.join(dir,"pnpm-workspace.yaml"),"  untracked-pkg: 1.0.0\n");
  assert.throws(()=>generate(dir), error => {
    assert.match(String(error.stderr), /Overrides missing inventory/);
    return true;
  });
}));
