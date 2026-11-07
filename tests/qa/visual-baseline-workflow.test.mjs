import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWorkingTree, specArguments, validateSnapshotChanges } from "../frontend/visual/scripts/baseline-contract.mjs";
import { publish } from "../frontend/visual/scripts/publish-baseline-pr.mjs";

const baseline = "tests/frontend/visual/pages/auth.spec.ts-snapshots/login-ui-dark-lg-linux.png";
const present = (path) => path.endsWith("auth.spec.ts");

test("refresh scopes select only the authoritative visual specs", () => {
  assert.deepEqual(specArguments("all"), []);
  assert.deepEqual(specArguments("auth"), ["tests/frontend/visual/pages/auth.spec.ts"]);
  assert.throws(() => specArguments("unknown"), /Unsupported/);
});

test("allow a changed Linux snapshot and an idempotent no-op", () => {
  assert.deepEqual(validateSnapshotChanges([baseline, baseline], "auth", { fileExists: present }), [baseline]);
  assert.deepEqual(validateSnapshotChanges([], "all"), []);
});

test("reject foreign scopes, retired specs, paths and OS baselines", () => {
  assert.throws(() => validateSnapshotChanges([baseline], "legal", { fileExists: present }), /outside/);
  assert.throws(() => validateSnapshotChanges([baseline], "all", { fileExists: () => false }), /outside/);
  for (const path of [
    "src/styles.css",
    "tests/frontend/visual/pages/auth.spec.ts-snapshots/login-ui-dark-lg-win32.png",
    "tests/frontend/visual/pages/auth.spec.ts-snapshots/../../secrets-linux.png",
  ]) {
    assert.throws(() => validateSnapshotChanges([path], "all", { fileExists: present }), /Refusing/);
  }
});

test("parse Git porcelain status without permitting deletion or renaming", () => {
  assert.deepEqual(parseWorkingTree(" M " + baseline + "\0?? " + baseline + "\0"), [baseline, baseline]);
  assert.throws(() => parseWorkingTree(" D " + baseline + "\0"), /Unexpected git change status/);
  assert.throws(() => parseWorkingTree("R  old\0new\0"), /Unexpected git change status/);
});

const publishArgs = {
  files: [baseline],
  testedSha: "abc123",
  sourceBranch: "feature",
  runId: "12345",
  repository: "Example/FitVibe",
  loadFile: async () => Buffer.from("snapshot"),
};

test("no changed snapshots do not create a branch or PR", async () => {
  const result = await publish({ ...publishArgs, files: [], request: () => { throw Error("request must not run"); } });
  assert.equal(result.status, "unchanged");
});

test("refuse stale source branches before any writes", async () => {
  let calls = 0;
  await assert.rejects(publish({
    ...publishArgs,
    request: async () => { calls++; return { object: { sha: "updated" } }; },
  }), /advanced/);
  assert.equal(calls, 1);
});

test("refuse unauthorized branch before any API calls", async () => {
  await assert.rejects(publish({
    ...publishArgs,
    sourceBranch: "unexpected",
    request: () => { throw Error("should not call API"); },
  }), /not allowed/);
});

test("publish validated baseline changes via isolated branch and draft PR", async () => {
  const calls = [];
  const response = {
    "/git/ref/heads/feature": { object: { sha: "abc123" } },
    "/git/commits/abc123": { tree: { sha: "tree0" } },
    "/git/blobs": { sha: "blob" },
    "/git/trees": { sha: "tree1" },
    "/git/commits": { sha: "commit1" },
    "/git/refs": {},
    "/pulls": { html_url: "https://github.com/Example/FitVibe/pull/123" },
    "/actions/workflows/ci.yml/dispatches": {},
  };
  const result = await publish({
    ...publishArgs,
    request: async (path, options) => {
      calls.push({ path, body: options?.body && JSON.parse(options.body) });
      return response[path];
    },
  });
  assert.equal(result.status, "created");
  assert.equal(result.branch, "fix/visual-baselines-12345");
  assert.equal(calls[3].body.tree[0].path, baseline);
  assert.equal(calls[5].body.ref, "refs/heads/fix/visual-baselines-12345");
  assert.equal(calls[6].body.base, "feature");
  assert.equal(calls[6].body.draft, true);
  assert.equal(calls[7].path, "/actions/workflows/ci.yml/dispatches");
  assert.equal(calls[7].body.ref, "fix/visual-baselines-12345");
  assert.equal(result.ci, "dispatched");
});

test("publishing errors propagate without claiming success", async () => {
  await assert.rejects(publish({
    ...publishArgs,
    request: async (path) => {
      if (path === "/git/ref/heads/feature") return { object: { sha: "abc123" } };
      throw new Error("GitHub API failure");
    },
  }), /GitHub API failure/);
});
