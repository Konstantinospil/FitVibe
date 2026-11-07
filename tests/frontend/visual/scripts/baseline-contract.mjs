import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const VISUAL_SCOPES = Object.freeze({
  all: null,
  auth: "tests/frontend/visual/pages/auth.spec.ts",
  legal: "tests/frontend/visual/pages/legal.spec.ts",
  home: "tests/frontend/visual/pages/home.spec.ts",
  navbar: "tests/frontend/visual/components/navbar.spec.ts",
});

export function specArguments(scope) {
  if (!Object.hasOwn(VISUAL_SCOPES, scope)) {
    throw new Error("Unsupported visual refresh scope: " + scope);
  }
  return VISUAL_SCOPES[scope] ? [VISUAL_SCOPES[scope]] : [];
}

export function parseWorkingTree(output) {
  if (!output) return [];
  return output.split("\0").filter(Boolean).map((line) => {
    const status = line.slice(0, 2);
    if (![" M", "??"].includes(status) || line[2] !== " ") {
      throw new Error("Unexpected git change status: " + JSON.stringify(line));
    }
    return line.slice(3);
  });
}

export function validateSnapshotChanges(paths, scope, options = {}) {
  const selected = specArguments(scope);
  const root = options.root ?? process.cwd();
  const fileExists = options.fileExists ?? existsSync;
  const unique = [...new Set(paths)];
  for (const path of unique) {
    const match = /^tests\/frontend\/visual\/(pages|components)\/([a-z0-9][a-z0-9-]*)\.spec\.ts-snapshots\/([a-zA-Z0-9][a-zA-Z0-9._-]*-linux\.png)$/.exec(path);
    if (!match) {
      throw new Error("Refusing non-Linux-snapshot modification: " + path);
    }
    const spec = "tests/frontend/visual/" + match[1] + "/" + match[2] + ".spec.ts";
    if (!fileExists(resolve(root, spec)) || (selected.length && !selected.includes(spec))) {
      throw new Error("Refusing snapshot outside selected, active visual spec: " + path);
    }
  }
  return unique.sort();
}

export function changedSnapshots(scope, cwd = process.cwd()) {
  const status = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { cwd, encoding: "utf8" },
  );
  return validateSnapshotChanges(parseWorkingTree(status), scope, { root: cwd });
}
