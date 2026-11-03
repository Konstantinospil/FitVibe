#!/usr/bin/env node
// The latest-version canary must never update the pinned package-manager toolchain.
import fs from "node:fs";
const filename = process.argv[2];
if (!filename) throw new Error("Toolchain snapshot path required");
const saved = JSON.parse(fs.readFileSync(filename, "utf8"));
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (!saved.packageManager || !saved.pnpm) throw new Error("Invalid toolchain snapshot");
manifest.packageManager = saved.packageManager;
manifest.devDependencies.pnpm = saved.pnpm;
fs.writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("Restored pnpm package manager pin and CLI dependency");
