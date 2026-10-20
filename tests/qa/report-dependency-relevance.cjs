#!/usr/bin/env node
// Advisory-only dependency relevance inventory. Never automatically remove a package.
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.DEPENDENCY_AUDIT_ROOT ? path.resolve(process.env.DEPENDENCY_AUDIT_ROOT) : path.resolve(__dirname, "../..");
const inventory = JSON.parse(fs.readFileSync(path.join(root,"docs/dependency-overrides.json"),"utf8"));
const lock = fs.readFileSync(path.join(root,"pnpm-lock.yaml"),"utf8");
const workspaces = ["package.json",...["apps","packages"].flatMap(dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(dir,e.name,"package.json")))].filter(p=>fs.existsSync(path.join(root,p)));
const direct = new Map();
for(const p of workspaces) {
  const j=JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
  for(const key of Object.keys({...j.dependencies,...j.devDependencies,...j.optionalDependencies})) direct.set(key,[...(direct.get(key)||[]),p]);
}
// Scan all pnpm package/snapshot keys, including subsequent sections in merged lockfiles.
// A package key is a two-space-indented name@version mapping, quoted or plain.
function lockPackageName(key) {
  const separator = key.lastIndexOf("@");
  if (separator <= 0 || !/^\d/.test(key.slice(separator + 1))) return null;
  return key.slice(0, separator);
}
const installed = new Set(
  [...lock.matchAll(/^  (?:'([^']+)'|([^:\s]+)):\s*$/gm)]
    .map(m => lockPackageName(m[1] || m[2]))
    .filter(Boolean),
);
const findings = [];
for(const o of inventory.overrides) {
  const majorScoped=/@\d+(?:\.\d+)?$/.test(o.name);
  const name=majorScoped?o.name.replace(/@\d+(?:\.\d+)?$/,""):o.name;
  if(!direct.has(name)&&!installed.has(name)&&!majorScoped&& !o.constraint.startsWith("link:")) findings.push({kind:"override-relevance-review",name:o.name,reason:"No direct declaration or resolved package found; verify before removal"});
}
// This is a partial static signal, not proof of unused code; dynamic loading and scripts are not captured.
const report={schemaVersion:1,scannedManifests:workspaces.length,checkedOverrides:inventory.overrides.length,findings,limitations:"Package graph presence is not code usage; indirect and dynamic references require separate static-analysis review."};
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,"\n### Dependency relevance (advisory)\nChecked "+report.checkedOverrides+" overrides; "+findings.length+" potential stale entries. No automatic deletion.\n");
