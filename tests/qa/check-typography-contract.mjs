#!/usr/bin/env node
/**
 * Typography contract gate.
 * Parses CSS declaration blocks while ignoring comments and quoted braces.
 * Rejects duplicate or divergent semantic role declarations.
 * The existing architecture hardcoding gate additionally checks raw JSX/CSS values.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = JSON.parse(fs.readFileSync(path.join(root, "design/typography.schema.json"), "utf8"));
const authority = "packages/ui/src/typography.css";
const roles = schema.roles;
const issues = [];

const size = (px) => (px / 16).toString().replace(/\.0$/, "") + "rem";
const lineOf = (s, i) => s.slice(0, i).split("\n").length;
const emit = (file, source, offset, message) => {
  issues.push({ file, line: lineOf(source, offset), message });
};
const scan = (file, visit) => {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  // Extract declarations within blocks. Comments removed but newlines preserved to
  // keep GitHub annotations useful. Ignore @media nesting for declaration inspection.
  const clean = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  for (const match of clean.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g)) {
    visit({ name: match[1], value: match[2].trim(), index: match.index, content });
  }
  return content;
};
const required = new Map();
for (const [role, values] of Object.entries(roles)) {
  if (!Array.isArray(values) || values.length !== 7) {
    issues.push({ file: "design/typography.schema.json", line: 1, message: "Invalid typography role " + role });
    continue;
  }
  const [family, weight, desktop, desktopLine, spacing, mobile, mobileLine] = values;
  if (!["Inter", "Roboto Flex"].includes(family) || ![400, 582, 600].includes(weight) ||
      ![desktop, desktopLine, mobile, mobileLine].every(x => Number.isFinite(x) && x > 0) ||
      !Number.isFinite(spacing)) {
    issues.push({ file: "design/typography.schema.json", line: 1, message: "Invalid typography properties for " + role });
  }
  required.set("--typography-" + role + "-size", [size(desktop), size(mobile)]);
  required.set("--typography-" + role + "-line-height", [size(desktopLine), size(mobileLine)]);
}
const text = fs.readFileSync(path.join(root, authority), "utf8");
const breakpoint = new RegExp("@media\\s*\\(max-width:\\s*" + schema.mobileBreakpointPx + "px\\s*\\)");
const splitAt = text.search(breakpoint);
if (splitAt < 0) emit(authority, text, 0, "Missing canonical mobile breakpoint.");
const declarations = new Map();
scan(authority, ({ name, value, index, content }) => {
  if (!name.startsWith("--typography-")) return;
  const mode = index > splitAt && splitAt >= 0 ? 1 : 0;
  const expected = required.get(name);
  if (!expected) return emit(authority, content, index, "Unknown typography token " + name);
  const key = name + ":" + mode;
  if (declarations.has(key)) emit(authority, content, index, "Duplicate role declaration " + key);
  declarations.set(key, value);
  if (value !== expected[mode]) emit(authority, content, index, name + " must equal " + expected[mode] + ", got " + value);
});
for (const [name] of required) for (const mode of [0,1])
  if (!declarations.has(name + ":" + mode)) emit(authority, text, 0, "Missing " + (mode ? "mobile" : "desktop") + " declaration " + name);

const paths = ["apps/frontend/src", "apps/backoffice/src", "packages/ui/src"];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
for (const dir of paths) for (const abs of walk(path.join(root, dir))) {
  if (!/\.(css|scss)$/.test(abs)) continue;
  const file = path.relative(root, abs).replaceAll(path.sep, "/");
  if (file === authority) continue;
  scan(file, ({ name, index, content }) => {
    if (name.startsWith("--typography-")) emit(file, content, index, "Typography role may only be declared by " + authority);
  });
}
// The authority is imported once and is shared by the athlete app. Backoffice's
// separate token authority is reported by the existing architecture check.
const globalFile = "apps/frontend/src/styles/global.css";
const globalCss = fs.readFileSync(path.join(root, globalFile), "utf8");
const backofficeFile = "apps/backoffice/src/styles/global.css";
const backofficeCss = fs.readFileSync(path.join(root, backofficeFile), "utf8");
if (!backofficeCss.includes('@import "../../../../packages/ui/src/typography.css";')) emit(backofficeFile, backofficeCss, 0, "Backoffice must import the shared typography contract.");
if (!globalCss.includes('@import "../../../../packages/ui/src/typography.css";')) emit(globalFile, globalCss, 0, "Typography contract must be imported.");

for (const finding of issues) console.error("::error file=" + finding.file + ",line=" + finding.line + "::" + finding.message);
if (issues.length) process.exit(1);
console.log("Typography contract check passed: " + required.size / 2 + " roles, desktop and mobile.");
