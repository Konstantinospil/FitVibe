#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

function walk(relativeRoot, extensions) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(fullPath);
    }
  }
  return files;
}

function toRelative(absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

const forceExitFiles = [
  path.join(root, "package.json"),
  path.join(root, "apps/backend/package.json"),
  path.join(root, "apps/backend/jest.config.cjs"),
  ...walk(".github/workflows", [".yml", ".yaml"]),
  ...walk("scripts", [".js", ".cjs", ".mjs", ".sh"]),
];

for (const absolutePath of forceExitFiles) {
  if (!fs.existsSync(absolutePath)) continue;
  const content = fs.readFileSync(absolutePath, "utf8");
  if (/--forceExit\b|\bforceExit\s*:/.test(content)) {
    failures.push(toRelative(absolutePath) + ": forced Jest termination is forbidden; fix the open handle instead");
  }
}

const globalSetup = read("apps/backend/jest.setup.ts");
if (/jest\.clearAllTimers\s*\(/.test(globalSetup) || /jest\.useRealTimers\s*\(/.test(globalSetup)) {
  failures.push("apps/backend/jest.setup.ts: global timer reset is forbidden; fake-timer suites must restore their own timers");
}

const activeTestRoots = ["tests/backend", "apps/backend/src", "tests/frontend", "tests/backoffice"];

for (const relativeRoot of activeTestRoots) {
  for (const absolutePath of walk(relativeRoot, [".js", ".cjs", ".mjs", ".jsx", ".ts", ".tsx"])) {
    const relativePath = toRelative(absolutePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    if (/\bjest\.useFakeTimers\s*\(/.test(content) && !/\bjest\.useRealTimers\s*\(/.test(content)) {
      failures.push(relativePath + ": jest.useFakeTimers() requires same-file jest.useRealTimers() cleanup");
    }
    if (/\bvi\.useFakeTimers\s*\(/.test(content) && !/\bvi\.useRealTimers\s*\(/.test(content)) {
      failures.push(relativePath + ": vi.useFakeTimers() requires same-file vi.useRealTimers() cleanup");
    }
  }
}

if (failures.length > 0) {
  console.error("Test lifecycle violations:");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}

console.log("Test lifecycle gate passed: no forceExit and fake timers are restored by their owning suites.");
