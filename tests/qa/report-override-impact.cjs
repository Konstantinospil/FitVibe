#!/usr/bin/env node
// Advisory-only audit: a lockfile records WITH overrides, not what would resolve WITHOUT them.
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.DEPENDENCY_AUDIT_ROOT
  ? path.resolve(process.env.DEPENDENCY_AUDIT_ROOT) : path.resolve(__dirname, "../..");
const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs/dependency-overrides.json"), "utf8")).overrides;
const workspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
const section = workspace.split(/^overrides:\s*$/m)[1];
if (!section) throw new Error("No pnpm workspace overrides found");
const overrides = new Map([...section.matchAll(/^  ('[^']+'|[^:#\s]+):\s+(.+)$/gm)]
  .map(m => [m[1].replace(/^'|'$/g, ""), m[2].trim().replace(/^'|'$/g, "")]));
const manifestPaths = ["package.json"];
for (const folder of ["apps", "packages"]) {
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (!entry.isDirectory()) continue;
    const manifest = path.posix.join(folder, entry.name, "package.json");
    if (fs.existsSync(path.join(root, manifest))) manifestPaths.push(manifest);
  }
}
const manifests = manifestPaths.map(file => ({file, data:JSON.parse(fs.readFileSync(path.join(root,file),"utf8"))}));
const packagesSection = (lock.split(/^packages:\s*$/m)[1] || "").split(/^snapshots:\s*$/m)[0];
const snapshotsSection = lock.split(/^snapshots:\s*$/m)[1] || "";
function packageName(selector) {
  // pnpm selectors may include major ranges, e.g. minimatch@3 or path-to-regexp@0.1.
  const match = /^(.*)@(\d+(?:\.\d+)?)$/.exec(selector);
  return match ? match[1] : selector;
}
function escapeRx(s) { return s.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&"); }
function versionsIn(text, name) {
  const rx = new RegExp("^  ['\"]?" + escapeRx(name) + "@(\\d+\\.\\d+\\.\\d+[^:'\"\\s]*)['\"]?:", "gm");
  return [...new Set([...text.matchAll(rx)].map(m => m[1].split("(")[0]))].sort();
}
const results = inventory.map(item => {
  const selector = item.name, name = packageName(selector);
  const value = overrides.get(selector);
  const declarations = manifests.flatMap(({file,data}) =>
    ["dependencies","devDependencies","optionalDependencies"].flatMap(section =>
      typeof data[section]?.[name] === "string"
        ? [{manifest:file, section, requested:data[section][name]}] : []));
  const versions = versionsIn(packagesSection, name);
  const snapshots = versionsIn(snapshotsSection, name);
  // Snapshots reflect the actual resolved graph and include peer-dependent entries.
  // Use their versions as the authoritative fallback if package metadata is absent.
  const resolvedVersions = [...new Set([...versions, ...snapshots])].sort();
  const linked = String(value).startsWith("link:");
  const resolved = linked ? lock.includes(value) : resolvedVersions.length > 0;
  const classification = linked ? "local-patch-review"
    : !resolved ? "not-found-in-lockfile-review"
    : declarations.length ? "direct-and-transitive-review"
    : "transitive-review";
  return {
    name:selector, constraint:value ?? null, inventoryStatus:item.status,
    classification, resolvedVersions,
    snapshotVersions:snapshots, directDeclarations:declarations,
    requiresReview:item.status === "unverified-necessity",
    // A single lockfile cannot establish necessity, compatibility, or safe removal.
    overrideEffect:"not-determined",
    safeToRemove:false,
    nextStep:linked
      ? "Compare the local patch against upstream and test deployment on supported architectures."
      : !resolved
      ? "Confirm whether the selector is used and whether the lockfile is current."
      : declarations.length
      ? "Compare direct declarations and dependency parents; reinstall without this override in an isolated branch and run CI."
      : "Identify dependency parents and security justification; compare isolated no-override resolution and run CI."
  };
});
const missing = [...overrides.keys()].filter(key => !inventory.some(x => x.name === key));
if (missing.length) throw new Error("Overrides missing inventory: " + missing.join(", "));
const report = {
  schemaVersion:1,
  advisoryOnly:true,
  evidence:"Current pnpm workspace, manifests and lockfile. No no-override reinstall performed.",
  totals:{
    overrides:results.length,
    requiringJustification:results.filter(x => x.requiresReview).length,
    localPatches:results.filter(x => x.classification === "local-patch-review").length,
    absentFromLockfile:results.filter(x => x.classification === "not-found-in-lockfile-review").length,
    demonstratedSafeToRemove:0
  },
  entries:results
};
process.stdout.write(JSON.stringify(report,null,2) + "\n");
