#!/usr/bin/env node
// Isolated dependency-override probe. Never run this against a release checkout.
// The caller is responsible for regenerating the lockfile and running security tests.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function removeSingleOverride(source, name, inventory) {
  if (typeof name !== "string" || !name.trim() || name === "all") {
    throw new Error("Specify exactly one override name; bulk removal is prohibited");
  }
  if (!Array.isArray(inventory?.overrides)) {
    throw new Error("A valid override inventory is required");
  }
  const record = inventory.overrides.find((item) => item.name === name);
  if (!record) throw new Error("Override is missing from the inventory: " + name);

  const lines = source.split("\n");
  let insideOverrides = false;
  let foundSection = false;
  let removed = 0;
  const kept = [];

  for (const line of lines) {
    if (line === "overrides:") {
      if (foundSection) throw new Error("Duplicate overrides section");
      foundSection = true;
      insideOverrides = true;
      kept.push(line);
      continue;
    }
    if (insideOverrides && line.trim() && !/^\s/.test(line)) {
      insideOverrides = false;
    }
    if (insideOverrides) {
      const match = /^  (?:'([^']+)'|"([^"]+)"|([^:#\s]+)):\s+(.+?)\s*$/.exec(line);
      if (match && (match[1] || match[2] || match[3]) === name) {
        removed += 1;
        const currentValue = match[4].replace(/^['"]|['"]$/g, "");
        if (currentValue !== record.constraint) {
          throw new Error("Workspace/inventory constraint mismatch for " + name);
        }
        continue;
      }
    }
    kept.push(line);
  }
  if (!foundSection) throw new Error("Missing workspace overrides section");
  if (removed !== 1) throw new Error("Expected exactly one matching override; found " + removed);
  return { content: kept.join("\n"), record };
}

function main() {
  const name = process.argv[2];
  const root = process.cwd();
  const workspacePath = path.join(root, "pnpm-workspace.yaml");
  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, "docs/dependency-overrides.json"), "utf8"),
  );
  const source = fs.readFileSync(workspacePath, "utf8");
  const result = removeSingleOverride(source, name, inventory);
  fs.writeFileSync(workspacePath, result.content);
  console.log(JSON.stringify({
    removed: name,
    previousConstraint: result.record.constraint,
    classification: result.record.status,
    reason: result.record.reason,
    removalCriteria: result.record.removalCriteria,
    warning: "Temporary probe only; documentation and release branches are unchanged",
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
