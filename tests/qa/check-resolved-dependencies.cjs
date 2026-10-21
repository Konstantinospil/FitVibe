#!/usr/bin/env node
// Validate that each installed direct dependency satisfies its workspace manifest.
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.DEPENDENCY_AUDIT_ROOT || path.resolve(__dirname, "../..");
const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const lines = lock.split(/\r?\n/);
const violations = [];
let importer = null, section = null, dep = null, version = null;
function tuple(value) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value);
  return m ? m.slice(1,4).map(Number) : null;
}
function cmp(a,b) { for(let i=0;i<3;i++) if(a[i]!==b[i]) return Math.sign(a[i]-b[i]); return 0; }
function satisfies(actual, range) {
  if (range.startsWith("workspace:") || range.startsWith("link:") || range.startsWith("file:")) return true;
  const resolved=tuple(actual), wanted=tuple(range.replace(/^(\^|~|>=|>|<=|<|=)/,""));
  if (!resolved || !wanted) return null; // Complex ranges need explicit review, not invented support.
  const op=range.match(/^(\^|~|>=|>|<=|<|=)/)?.[0] || "=";
  const c=cmp(resolved,wanted);
  if(op==="^") return c>=0 && (wanted[0]>0 ? resolved[0]===wanted[0] : wanted[1]>0 ? resolved[0]===0&&resolved[1]===wanted[1] : resolved[0]===0&&resolved[1]===0);
  if(op==="~") return c>=0 && resolved[0]===wanted[0]&&resolved[1]===wanted[1];
  return {">=":c>=0,">":c>0,"<=":c<=0,"<":c<0,"=":c===0}[op];
}
const flush=()=>{if(!importer||!dep||!version)return;const file=importer==="."?"package.json":importer+"/package.json";const abs=path.join(root,file);if(!fs.existsSync(abs))return;const manifest=JSON.parse(fs.readFileSync(abs,"utf8"));const declared={...manifest.dependencies,...manifest.devDependencies,...manifest.optionalDependencies};if(!Object.hasOwn(declared,dep))return;const valid=satisfies(version.split("(")[0],declared[dep]);if(valid===false)violations.push(file+": "+dep+" requires "+declared[dep]+" but resolves "+version);};
for(const line of lines){
  if(/^importers:\s*$/.test(line)){flush();importer=null;section=null;continue;}
  if(/^[^\s#][^:]*:\s*$/.test(line)&&!/^importers:/.test(line)){flush();importer=null;section=null;continue;}
  const im=/^  (\.|[^\s].*):\s*$/.exec(line);
  if(im && !line.startsWith("    ")){flush();importer=im[1].replace(/^'|'$/g,"");section=null;dep=null;version=null;continue;}
  if(!importer)continue;
  const sec=/^    (dependencies|devDependencies|optionalDependencies):\s*$/.exec(line);
  if(sec){flush();section=sec[1];dep=null;version=null;continue;}
  if(/^    \S/.test(line)){flush();section=null;dep=null;version=null;continue;}
  if(!section)continue;
  const p=/^      (?:'([^']+)'|([^:]+)):\s*$/.exec(line);
  if(p){flush();dep=p[1]||p[2];version=null;continue;}
  const v=/^        version:\s+['"]?([^\s'"]+)/.exec(line);
  if(v)version=v[1];
}
flush();
if(violations.length){console.error(violations.join("\n"));process.exitCode=1;}
else console.log("Resolved direct dependency versions satisfy supported manifest ranges.");
