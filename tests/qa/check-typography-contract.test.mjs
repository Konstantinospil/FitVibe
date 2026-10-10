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
  copy("apps/frontend/src/styles/tokens.css");
  copy("apps/backoffice/src/styles/global.css");
  fs.mkdirSync(path.join(workspace, "packages/ui/src"), { recursive: true });
  const gate = path.join(root, "tests/qa/check-typography-contract.mjs");
  const run = () => spawnSync(process.execPath, [gate], { cwd: workspace, encoding: "utf8" });
  const verify = (status, description, diagnostic) => {
    const result = run();
    const output = [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n");
    assert.equal(result.status, status, description + "\n" + output);
    if (diagnostic) assert.match(output, diagnostic, description + "\n" + output);
  };

  verify(0, "The canonical typography contract must pass", /Typography contract check passed:/);
  const rogue = path.join(workspace, "packages/ui/src/rogue.css");
  fs.writeFileSync(rogue, ".bad { --typography-page-title-size: 42px; }\n");
  verify(
    1,
    "Local role redeclaration must fail",
    /::error file=packages\/ui\/src\/rogue\.css,line=1::Typography tokens may only be declared/,
  );
  fs.writeFileSync(rogue, ".bad { font-size: 27px; }\n");
  verify(
    1,
    "Raw CSS font sizes must fail",
    /::error file=packages\/ui\/src\/rogue\.css,line=1::Typography declarations must use approved role tokens, not raw values: font-size/,
  );
  fs.writeFileSync(rogue, ".bad { font: 600 27px Arial; }\n");
  verify(
    1,
    "Font shorthand bypasses must fail",
    /::error file=packages\/ui\/src\/rogue\.css,line=1::Font shorthand must reference a canonical typography role/,
  );
  fs.rmSync(rogue);

  const rogueTsx = path.join(workspace, "apps/frontend/src/rogue.tsx");
  fs.mkdirSync(path.dirname(rogueTsx), { recursive: true });
  fs.writeFileSync(
    rogueTsx,
    'export const Example = () => <h1 style={{ fontSize: "27px" }}>Heading</h1>;\n',
  );
  verify(
    1,
    "TypeScript AST must reject raw inline typography",
    /::error file=apps\/frontend\/src\/rogue\.tsx,line=1::Inline typography value must use an approved design token: fontSize/,
  );
  fs.writeFileSync(
    rogueTsx,
    'export const Example = () => <h1 style={{ fontSize: "var(--typography-page-title-size)" }}>Heading</h1>;\n',
  );
  verify(0, "TypeScript AST must accept role-backed inline typography", /Typography contract check passed:/);
  fs.rmSync(rogueTsx);

  for (const file of ["apps/frontend/src/styles/tokens.css", "apps/backoffice/src/styles/global.css"]) {
    const local = path.join(workspace, file);
    const original = fs.readFileSync(local, "utf8");
    fs.appendFileSync(local, "\n:root { --font-family-base: var(--font-family-body); }\n");
    verify(
      1,
      file + " must not redeclare shared aliases",
      new RegExp(
        "::error file=" +
          file.replaceAll("/", "\\/").replaceAll(".", "\\.") +
          ",line=\\d+::Typography tokens may only be declared",
      ),
    );
    fs.writeFileSync(local, original);
  }

  const css = path.join(workspace, "packages/ui/src/typography.css");
  const original = fs.readFileSync(css, "utf8");
  fs.writeFileSync(
    css,
    original.replace("--typography-page-title-size: 2rem;", "--typography-page-title-size: 3rem;"),
  );
  verify(1, "Changed desktop Figma value must fail", /--typography-page-title-size must equal 2rem, got 3rem/);
  fs.writeFileSync(
    css,
    original.replace("--typography-page-title-size: 1.75rem;", "--typography-page-title-size: 2rem;"),
  );
  verify(1, "Changed mobile value must fail", /--typography-page-title-size must equal 1.75rem, got 2rem/);
  console.log(
    "Typography gate fixtures passed: valid, unauthorized roles/aliases, raw font size, shorthand, inline values, desktop drift, mobile drift.",
  );
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
