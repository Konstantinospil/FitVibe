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

function afterEachRestoresTimers(content, framework) {
  const hookPattern = /\bafterEach\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  const timerPattern = new RegExp("\\b" + framework + "\\.useRealTimers\\s*\\(");
  let hookMatch;

  while ((hookMatch = hookPattern.exec(content)) !== null) {
    const blockStart = content.indexOf("{", hookMatch.index);
    if (blockStart < 0) continue;

    let depth = 0;
    for (let index = blockStart; index < content.length; index += 1) {
      if (content[index] === "{") depth += 1;
      if (content[index] !== "}") continue;

      depth -= 1;
      if (depth !== 0) continue;

      const hookBody = content.slice(blockStart + 1, index);
      if (timerPattern.test(hookBody)) return true;

      hookPattern.lastIndex = index + 1;
      break;
    }
  }

  return false;
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
    failures.push(
      toRelative(absolutePath) + ": forced Jest termination is forbidden; fix the open handle instead",
    );
  }
}

for (const relativePath of ["apps/backend/jest.setup.ts", "tests/setup/jest.setup.ts"]) {
  const globalSetup = read(relativePath);
  if (/jest\.clearAllTimers\s*\(/.test(globalSetup) || /jest\.useRealTimers\s*\(/.test(globalSetup)) {
    failures.push(
      relativePath +
        ": global timer reset is forbidden; fake-timer suites must restore their own timers in afterEach",
    );
  }
}

const activeTestRoots = ["tests/backend", "apps/backend/src", "tests/frontend", "tests/backoffice"];

for (const relativeRoot of activeTestRoots) {
  for (const absolutePath of walk(relativeRoot, [".js", ".cjs", ".mjs", ".jsx", ".ts", ".tsx"])) {
    const relativePath = toRelative(absolutePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    if (/\bjest\.useFakeTimers\s*\(/.test(content) && !afterEachRestoresTimers(content, "jest")) {
      failures.push(
        relativePath + ": jest.useFakeTimers() requires jest.useRealTimers() cleanup in afterEach",
      );
    }
    if (/\bvi\.useFakeTimers\s*\(/.test(content) && !afterEachRestoresTimers(content, "vi")) {
      failures.push(
        relativePath + ": vi.useFakeTimers() requires vi.useRealTimers() cleanup in afterEach",
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Test lifecycle violations:");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}

console.log(
  "Test lifecycle gate passed: no forceExit/global timer reset and fake timers are restored in afterEach.",
);
