const { execFileSync } = require("node:child_process");

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const isTestFile = (path) =>
  /\.(?:test|spec)\.(?:ts|tsx|js|jsx|cjs|mjs)$/.test(path);

const isArchived = (path) => path.startsWith("apps/frontend/archive/");

const owners = [
  {
    name: "backend-jest",
    matches: (path) => /^tests\/backend\/.*\.(?:test|spec)\.ts$/.test(path),
  },
  {
    name: "frontend-vitest",
    matches: (path) => /^tests\/frontend\/.*\.test\.(?:ts|tsx)$/.test(path),
  },
  {
    name: "frontend-e2e",
    matches: (path) => /^tests\/frontend\/e2e\/[^/]+\.spec\.cjs$/.test(path),
  },
  {
    // Executed explicitly by the E2E job with node --test before Playwright.
    name: "frontend-e2e-observer-contract",
    matches: (path) => path === "tests/frontend/e2e/request-observer.test.cjs",
  },
  {
    name: "frontend-visual",
    matches: (path) => /^tests\/frontend\/visual\/.*\.spec\.ts$/.test(path),
  },
  {
    name: "backoffice-e2e",
    matches: (path) => /^tests\/backoffice\/e2e\/[^/]+\.spec\.cjs$/.test(path),
  },
];

const candidates = files.filter((path) => isTestFile(path) && !isArchived(path));
const orphaned = [];
const ownership = new Map();

for (const path of candidates) {
  const owner = owners.find((entry) => entry.matches(path));
  if (!owner) {
    orphaned.push(path);
    continue;
  }

  ownership.set(owner.name, (ownership.get(owner.name) || 0) + 1);
}

for (const owner of owners) {
  console.log(`${owner.name}: ${ownership.get(owner.name) || 0} test files`);
}

console.log(`archived/excluded: ${files.filter((path) => isTestFile(path) && isArchived(path)).length} test files`);

if (orphaned.length > 0) {
  console.error("Orphaned test files are not owned by any authoritative CI runner:");
  for (const path of orphaned) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log(`All ${candidates.length} active test files are owned by an authoritative CI runner.`);
