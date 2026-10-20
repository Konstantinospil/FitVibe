#!/usr/bin/env node
// Source-level dependency inventory. Advisory until existing imports are reviewed.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { builtinModules } = require("node:module");
const root = path.resolve(__dirname, "../..");
const builtins = new Set(builtinModules.map(n => n.replace(/^node:/, "")));
const sourceExtensions = /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/;
const dirs = ["apps", "packages"];
function list(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", "coverage", "archive", ".next", ".turbo"].includes(e.name)) continue;
    const file = path.join(dir, e.name);
    if (e.isDirectory()) list(file, files);
    else if (sourceExtensions.test(e.name) && e.isFile()) files.push(file);
  }
  return files;
}
function pkgName(spec) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("#") || spec.startsWith("@/") || spec.startsWith("~/") || spec.startsWith("virtual:") || spec.startsWith("\0") || spec.includes("://")) return null;
  const n = spec.replace(/^node:/, "").split("/");
  if (builtins.has(n[0]) || spec.startsWith("node:")) return null;
  return spec.startsWith("@") ? n.slice(0, 2).join("/") : n[0];
}
function importsOf(source, file) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const result = new Set();
  function add(node) { if (node && ts.isStringLiteralLike(node)) result.add(node.text); }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
    if (ts.isCallExpression(node) && node.arguments.length === 1 && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...result];
}
const reports = [];
for (const area of dirs) {
  const base = path.join(root, area);
  if (!fs.existsSync(base)) continue;
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(base, entry.name), manifestFile = path.join(dir, "package.json");
    if (!fs.existsSync(manifestFile)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const declared = new Set(Object.keys({...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies}));
    const found = new Map();
    const files = list(path.join(dir, "src"));
    for (const file of files) {
      for (const spec of importsOf(fs.readFileSync(file, "utf8"), file)) {
        const name = pkgName(spec);
        if (name) found.set(name, [...(found.get(name) || []), path.relative(root, file)]);
      }
    }
    const undeclared = [...found.keys()].filter(name => !declared.has(name)).map(name => ({name, files:found.get(name).slice(0,3)}));
    const unusedCandidates = [...declared].filter(name => !found.has(name)).map(name => ({name, reason:"No static import in src; may be used by scripts, tooling, config, runtime or tests"}));
    reports.push({workspace:path.relative(root,dir), files:files.length, undeclared, unusedCandidates});
  }
}
const summary = reports.flatMap(r => r.undeclared.map(d => ({workspace:r.workspace,...d})));
const result = {schemaVersion:1, workspaces:reports, undeclaredCount:summary.length, limitations:"Only static imports, re-exports and literal require()/import() inside workspace src are analyzed; scripts, plugins, dynamic imports and other code paths need review."};
console.log(JSON.stringify(result,null,2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = reports.map(r => "| "+r.workspace+" | "+r.undeclared.length+" | "+r.unusedCandidates.length+" |").join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Source dependency analysis (advisory)\n| Workspace | Undeclared imports | Possible unused declarations |\n|---|---:|---:|\n"+rows+"\n");
}
if (process.argv.includes("--strict") && summary.length) process.exitCode = 1;
