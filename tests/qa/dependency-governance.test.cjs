#!/usr/bin/env node
const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
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

test("transitive package fixture occurs after the first snapshots section", () => {
  const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  const firstSnapshots = lock.indexOf("\n".concat("snapshots:"));
  const transitive = lock.indexOf("  follow-redirects@1.16.1:");
  assert.ok(firstSnapshots >= 0 && transitive > firstSnapshots, "fixture must exercise post-snapshots entries");
  const r = report("report-dependency-relevance.cjs");
  assert.ok(!r.findings.some(f => f.name === "follow-redirects"));
});

function fixture(callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-deps-"));
  try {
    fs.mkdirSync(path.join(dir, "docs"), {recursive:true});
    fs.mkdirSync(path.join(dir, "apps", "example", "src"), {recursive:true});
    fs.mkdirSync(path.join(dir, "packages"), {recursive:true});
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({name:"fixture",private:true}));
    fs.writeFileSync(path.join(dir, "apps", "example", "package.json"), JSON.stringify({name:"@fixture/example",dependencies:{"used-package":"^1.0.0","unused-package":"^1.0.0"}}));
    fs.writeFileSync(path.join(dir, "apps", "example", "src", "index.ts"), 'import "used-package";\nimport "missing-package";\n');
    fs.writeFileSync(path.join(dir, "apps", "example", "tsconfig.json"), JSON.stringify({compilerOptions:{paths:{"@internal/types":["../../packages/types.d.ts"]}}}));
    fs.writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\noverrides:\n  'obsolete-package': '1.0.0'\n");
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\npackages:\n  used-package@1.0.0:\n    resolution: {}\nsnapshots:\n  used-package@1.0.0: {}\n");
    fs.writeFileSync(path.join(dir, "docs", "dependency-overrides.json"), JSON.stringify({overrides:[{name:"obsolete-package",constraint:"1.0.0",status:"unverified-necessity",reason:"Fixture",removalCriteria:"Fixture"}]}));
    return callback(dir);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
function fixtureReport(name,dir,extra=[]) {
  const stdout=execFileSync(process.execPath,[path.join(root,"tests/qa",name),...extra],{cwd:root,encoding:"utf8",env:{...process.env,DEPENDENCY_AUDIT_ROOT:dir}});
  try { return JSON.parse(stdout); } catch { return stdout; }
}
test("controlled fixture reports missing imports and unused declarations", () => fixture(dir => {
  const report=fixtureReport("analyze-source-dependencies.cjs",dir);
  const app=report.workspaces.find(x=>x.workspace===path.join("apps","example"));
  assert.ok(app.undeclared.some(x=>x.name==="missing-package"));
  assert.ok(app.unusedCandidates.some(x=>x.name==="unused-package"));
  assert.ok(!app.undeclared.some(x=>x.name==="used-package"));
}));
test("controlled fixture flags an override with no resolved package", () => fixture(dir => {
  const report=fixtureReport("report-dependency-relevance.cjs",dir);
  assert.ok(report.findings.some(x=>x.name==="obsolete-package"));
}));
test("controlled fixture rejects undocumented version contradictions", () => fixture(dir => {
  fs.writeFileSync(path.join(dir,"pnpm-workspace.yaml"),"packages:\n  - 'apps/*'\noverrides:\n  'used-package': '2.0.0'\n");
  fs.writeFileSync(path.join(dir,"docs","dependency-overrides.json"),JSON.stringify({overrides:[{name:"used-package",constraint:"2.0.0",status:"unverified-necessity",reason:"Fixture",removalCriteria:"Fixture"}]}));
  assert.throws(() => fixtureReport("check-dependency-overrides.cjs",dir), /Command failed/);
}));

test("controlled fixture rejects extra root package.json overrides", () => fixture(dir => {
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({name:"fixture",private:true,overrides:{"hidden-package":"1.0.0"}}));
  assert.throws(() => fixtureReport("check-dependency-overrides.cjs",dir), /Command failed/);
}));
test("controlled fixture rejects root pnpm.overrides", () => fixture(dir => {
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({name:"fixture",private:true,pnpm:{overrides:{"hidden-package":"1.0.0"}}}));
  assert.throws(() => fixtureReport("check-dependency-overrides.cjs",dir), /Command failed/);
}));
test("resolved dependency contract rejects a direct version below the manifest requirement", () => fixture(dir => {
  fs.writeFileSync(path.join(dir,"pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters:\n  apps/example:\n    dependencies:\n      used-package:\n        specifier: ^1.2.0\n        version: 1.0.0\n");
  fs.writeFileSync(path.join(dir,"apps/example/package.json"),JSON.stringify({dependencies:{"used-package":"^1.2.0"}}));
  assert.throws(() => fixtureReport("check-resolved-dependencies.cjs",dir), /Command failed/);
}));
test("resolved dependency contract accepts a compatible direct dependency", () => fixture(dir => {
  fs.writeFileSync(path.join(dir,"pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters:\n  apps/example:\n    dependencies:\n      used-package:\n        specifier: ^1.0.0\n        version: 1.2.0\n");
  const out=fixtureReport("check-resolved-dependencies.cjs",dir);
  assert.match(out,/satisfy supported manifest ranges/);
}));

test("Lighthouse upgrade is tracked without reinstating Zod or Jest overrides", () => {
  const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs/dependency-overrides.json"), "utf8"));
  assert.equal(manifest.devDependencies.lighthouse, "13.5.0");
  assert.match(workspace, /^  'lighthouse': '13\\.5\\.0'$/m);
  assert.doesNotMatch(workspace, /^  ['"]?(?:zod|chromium-bidi>zod|jest)['"]?:/m);
  assert.ok(inventory.overrides.some(item => item.name === "lighthouse" && item.constraint === "13.5.0"));
  assert.ok(!inventory.overrides.some(item => ["jest", "chromium-bidi>zod", "zod"].includes(item.name)));
});
