#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-typography-"));
try {
  const copy = (p) => {
    const target = path.join(workspace, p);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, p), target);
  };
  copy("design/typography.schema.json");
  copy("packages/ui/src/typography.css");
  copy("apps/frontend/src/styles/global.css");
  copy("apps/backoffice/src/styles/global.css");
  fs.mkdirSync(path.join(workspace, "packages/ui/src"), { recursive: true });
  const gate = path.join(root, "tests/qa/check-typography-contract.mjs");
  const run = () => spawnSync(process.execPath, [gate], { cwd: workspace, encoding: "utf8" });
  assert.equal(run().status, 0, "The canonical typography contract must pass");
  const rogue = path.join(workspace, "packages/ui/src/rogue.css");
  fs.writeFileSync(rogue, ".bad { --typography-page-title-size: 42px; }\n");
  assert.notEqual(run().status, 0, "Local role redeclaration must fail");
  fs.writeFileSync(rogue, ".bad { font-size: 27px; }\n");
  assert.notEqual(run().status, 0, "Raw CSS font sizes must fail");
  fs.writeFileSync(rogue, ".bad { font: 600 27px Arial; }\n");
  assert.notEqual(run().status, 0, "Font shorthand bypasses must fail");
  fs.rmSync(rogue);
  const css = path.join(workspace, "packages/ui/src/typography.css");
  const original = fs.readFileSync(css, "utf8");
  fs.writeFileSync(css, original.replace("--typography-page-title-size: 2rem;", "--typography-page-title-size: 3rem;"));
  assert.notEqual(run().status, 0, "Changed desktop Figma value must fail");
  fs.writeFileSync(css, original.replace("--typography-page-title-size: 1.75rem;", "--typography-page-title-size: 2rem;"));
  assert.notEqual(run().status, 0, "Changed mobile value must fail");
  console.log("Typography gate fixtures passed: valid, unauthorized role, raw font size, shorthand, desktop drift, mobile drift.");
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
