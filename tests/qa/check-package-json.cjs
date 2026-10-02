#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const SEARCH_ROOTS = ["apps", "packages"];
const MANIFEST = "package.json";

function collectPackageJson(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPackageJson(full, results);
    } else if (entry.isFile() && entry.name === MANIFEST) {
      results.push(full);
    }
  }
}

function validateManifest(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) {
    throw new Error(`${path.relative(ROOT, file)} starts with a UTF-8 BOM`);
  }
  JSON.parse(raw);
}

const manifests = [path.join(ROOT, MANIFEST)];
for (const rel of SEARCH_ROOTS) {
  const dir = path.join(ROOT, rel);
  if (fs.existsSync(dir)) collectPackageJson(dir, manifests);
}

let failed = false;
for (const file of manifests) {
  try {
    validateManifest(file);
  } catch (error) {
    failed = true;
    console.error(`Invalid package manifest: ${path.relative(ROOT, file)}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failed) process.exit(1);
console.log(`Validated ${manifests.length} package manifests.`);
