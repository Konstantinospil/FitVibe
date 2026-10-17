#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeDesignSources } from "./design-authority-core.mjs";

const root = process.cwd();
const directories = ["apps/frontend/src", "apps/backoffice/src", "packages/ui/src"];
const authorities = new Set(["apps/frontend/src/styles/tokens.css","apps/frontend/src/styles/themes.css","packages/ui/src/typography.css","apps/backoffice/src/styles/global.css"]);
async function walk(dir) {
  const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(relative));
    else if (/\.(?:css|scss)$/.test(entry.name)) files.push(relative);
  }
  return files;
}
const files = (await Promise.all(directories.map(walk))).flat();
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await fs.readFile(path.join(root,file),"utf8")])));
const result = analyzeDesignSources(sources, { authorities });
const summary = {};
for (const finding of result.findings) summary[finding.type] = (summary[finding.type] ?? 0) + 1;
console.log(JSON.stringify({ authorityFiles:[...authorities], scannedFiles:files.length, tokenCount:result.tokenCount, findings:summary, details:result.findings }, null, 2));
if (process.argv.includes("--strict") && result.findings.length) process.exitCode = 1;
