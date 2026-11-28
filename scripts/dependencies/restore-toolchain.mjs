#!/usr/bin/env node
// The latest-version canary must never update the pinned package-manager toolchain.
// pnpm is pinned only through `packageManager`; it is not a devDependency.
import fs from "node:fs";
const filename = process.argv[2];
if (!filename) throw new Error("Toolchain snapshot path required");
const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!saved.packageManager) throw new Error("Invalid toolchain snapshot");
manifest.packageManager = saved.packageManager;
if (manifest.devDependencies) delete manifest.devDependencies.pnpm;
fs.writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("Restored pinned pnpm packageManager");
