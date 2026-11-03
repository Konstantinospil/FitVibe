import test from "node:test";
import assert from "node:assert/strict";
import { removeSingleOverride } from "../../scripts/dependencies/probe-override.mjs";

const inventory = {
  overrides: [
    { name: "glob", constraint: "14.0.2", status: "security-patch-required" },
    { name: "extract-zip", constraint: "link:packages/patched-extract-zip" },
  ],
};
const source = "packages:\n  - 'apps/*'\noverrides:\n  'glob': '14.0.2'\n  'extract-zip': 'link:packages/patched-extract-zip'\n";
test("one override removed without altering neighboring rules", () => {
  const outcome = removeSingleOverride(source, "glob", inventory);
  assert.equal(outcome.content.includes("  'glob':"), false);
  assert.equal(outcome.content.includes("  'extract-zip':"), true);
  assert.deepEqual(outcome.record, inventory.overrides[0]);
});
test("cannot bulk remove overrides", () => {
  assert.throws(() => removeSingleOverride(source, "all", inventory), /exactly one/);
  assert.throws(() => removeSingleOverride(source, "", inventory), /exactly one/);
});
test("missing or inconsistent inventory fails closed", () => {
  assert.throws(() => removeSingleOverride(source, "missing", inventory), /missing from the inventory/);
  assert.throws(() => removeSingleOverride(source, "glob", {overrides: [{name:"glob",constraint:"1.0.0"}]}), /mismatch/);
});
test("duplicate rules cannot be silently removed", () => {
  assert.throws(() => removeSingleOverride(source + "  'glob': '14.0.2'\n", "glob", inventory), /exactly one/);
});
