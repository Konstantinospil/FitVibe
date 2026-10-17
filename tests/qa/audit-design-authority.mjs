#!/usr/bin/env node
/**
 * Design authority inventory. Reports all frontend stylesheet value ownership
 * and magic-number candidates without silently accepting existing design debt.
 * Use --strict to fail on every finding once the migration is complete.
 */
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const root = process.cwd();
const directories = ["apps/frontend/src", "apps/backoffice/src", "packages/ui/src"];
const authorities = new Set([
  "apps/frontend/src/styles/tokens.css",
  "apps/frontend/src/styles/themes.css",
  "packages/ui/src/typography.css",
  "apps/backoffice/src/styles/global.css",
]);
const layoutValues = /(?:^|[\\s,(])[-+]?(?:\\d*\\.)?\\d+(?:px|rem|em|vh|vw|dvh|dvw|svh|lvh|pt|ch|ex|ms|s|deg)\\b/i;
const visualProperties = /^(?:width|height|min-|max-|margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|border(?:-.+)?-width|border-radius|outline(?:-.+)?|font-size|line-height|letter-spacing|box-shadow|text-shadow|transform|animation(?:-.+)?|transition(?:-.+)?)$/;
const findings = [];
const declarations = new Map();
const references = [];
async function walk(dir) {
  const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(relative));
    else if (/\\.(?:css|scss)$/.test(entry.name)) files.push(relative);
  }
  return files;
}
const files = (await Promise.all(directories.map(walk))).flat();
for (const file of files) {
  const source = await fs.readFile(path.join(root, file), "utf8");
  const tree = postcss.parse(source, { from: file });
  tree.walkDecls((decl) => {
    const line = decl.source?.start?.line ?? 1;
    const loc = `${file}:${line}`;
    if (decl.prop.startsWith("--")) {
      const definitions = declarations.get(decl.prop) ?? [];
      definitions.push({ file, selector: decl.parent?.selector ?? "", value: decl.value, loc });
      declarations.set(decl.prop, definitions);
      if (!authorities.has(file)) findings.push({ type: "unauthorized-definition", loc, detail: decl.prop });
    } else if (visualProperties.test(decl.prop) && layoutValues.test(decl.value.replace(/var\\([^)]*\\)/g, ""))) {
      findings.push({ type: "magic-number", loc, detail: `${decl.prop}: ${decl.value}` });
    }
    for (const match of decl.value.matchAll(/var\\(\\s*(--[\\w-]+)/g)) {
      references.push({ name: match[1], loc });
    }
  });
}
for (const ref of references) {
  if (!declarations.has(ref.name)) findings.push({ type: "unresolved-token", loc: ref.loc, detail: ref.name });
}
for (const [name, definitions] of declarations) {
  for (const item of definitions) {
    if (item.value.includes(`var(${name}`)) {
      findings.push({ type: "self-reference", loc: item.loc, detail: name });
    }
  }
}
const summary = Object.groupBy(findings, item => item.type);
console.log(JSON.stringify({
  authorityFiles: [...authorities],
  scannedFiles: files.length,
  tokenCount: declarations.size,
  findings: Object.fromEntries(Object.entries(summary).map(([key, items]) => [key, items.length])),
  details: findings,
}, null, 2));
if (process.argv.includes("--strict") && findings.length) process.exitCode = 1;
