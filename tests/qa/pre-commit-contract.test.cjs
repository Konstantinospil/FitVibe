const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../..");
const hook = path.join(root, ".husky/pre-commit");
const configPath = path.join(root, ".lintstagedrc.js");

function run(command, args, cwd, env = process.env) {
  return spawnSync(command, args, { cwd, encoding: "utf8", env, timeout: 90_000 });
}

function git(dir, args) {
  const result = run("git", ["-C", dir, ...args], root);
  assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

test("staged-file contracts format supported extensions once and never suppress lint warnings", async () => {
  const config = (await import(pathToFileURL(configPath).href)).default;
  const tsx = config["*.{ts,tsx}"](["apps/frontend/src/Example.tsx"]);
  assert.deepEqual(tsx, [
    "prettier --write 'apps/frontend/src/Example.tsx'",
    "eslint --fix --max-warnings=0 'apps/frontend/src/Example.tsx'",
  ]);
  assert.deepEqual(config["*.{js,jsx,cjs,mjs}"](["tests/qa/example.cjs"]), [
    "prettier --write 'tests/qa/example.cjs'",
  ]);
  assert.deepEqual(config["*.{ts,tsx}"](["dist/Example.tsx", "node_modules/x.ts"]), []);
  assert.deepEqual(config["*.{json,md,yml,yaml}"](["pnpm-lock.yaml", "docs/README.md"]), [
    "prettier --write 'docs/README.md'",
  ]);
  const adversarial = "apps/frontend/src/a'; echo unexpected; '.tsx";
  const command = config["*.{ts,tsx}"]([adversarial])[0];
  const check = run("sh", ["-c", `printf '%s' ${command.slice("prettier --write ".length)}`], root);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(check.stdout, adversarial);
});

test("Husky v9 installs the current hook; CI remains read-only and owns quality checks", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const source = fs.readFileSync(hook, "utf8");
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  assert.equal(packageJson.scripts.prepare, "husky");
  assert.match(source, /set -eu/);
  assert.doesNotMatch(source, /husky\.sh/);
  for (const requirement of [
    "pnpm exec lint-staged --concurrent false",
    "node tests/security/secret-scan.cjs",
    "node tests/qa/assert-test-discovery.cjs",
    "pnpm architecture:check",
  ]) {
    assert.ok(source.includes(requirement), `Missing hook command: ${requirement}`);
  }
  assert.ok(source.indexOf("pnpm exec lint-staged") < source.indexOf("node tests/qa/assert-test-discovery"));
  assert.match(ci, /run: pnpm lint:check/);
  assert.match(ci, /run: node tests\/qa\/assert-test-discovery\.cjs/);
  assert.match(ci, /node tests\/qa\/check-architecture-hardcoding\.mjs backend/);
  assert.match(ci, /node --test tests\/qa\/pre-commit-contract\.test\.cjs/);
});

test("pre-commit refuses lint, ownership and architecture failures without continuing", () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-precommit-"));
  const bin = path.join(sandbox, "bin");
  fs.mkdirSync(bin);
  for (const name of ["pnpm", "node"]) {
    const mock = path.join(bin, name);
    fs.writeFileSync(mock, [
      "#!/bin/sh",
      `printf '${name} %s\\n' "$*" >> "$MOCK_LOG"`,
      'if [ "$MOCK_FAIL_AT" = "$*" ]; then exit 17; fi',
      "exit 0",
      "",
    ].join("\n"));
    fs.chmodSync(mock, 0o755);
  }
  try {
    const failures = [
      ["exec lint-staged --concurrent false", ["pnpm exec lint-staged --concurrent false"]],
      ["tests/qa/assert-test-discovery.cjs", ["pnpm exec lint-staged --concurrent false", "node tests/security/secret-scan.cjs", "node tests/qa/assert-test-discovery.cjs"]],
      ["architecture:check", ["pnpm exec lint-staged --concurrent false", "node tests/security/secret-scan.cjs", "node tests/qa/assert-test-discovery.cjs", "pnpm architecture:check"]],
    ];
    for (const [failure, expected] of failures) {
      const log = path.join(sandbox, "invocations");
      fs.writeFileSync(log, "");
      const result = run("sh", [hook], sandbox, {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH || ""}`,
        MOCK_LOG: log,
        MOCK_FAIL_AT: failure,
      });
      assert.equal(result.status, 17, `${failure}: ${result.stderr}`);
      assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), expected);
    }
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

test("real lint-staged fixes staged TSX, preserves untracked files and blocks unfixable warnings", { timeout: 120_000 }, () => {
  // A nested Git repository prevents test staging from modifying the checkout index.
  // Root ESLint/Prettier configuration remains discoverable by walking upward.
  const sandbox = fs.mkdtempSync(path.join(root, "tests/qa/precommit-fixture-"));
  try {
    git(sandbox, ["init", "-q"]);
    git(sandbox, ["config", "user.email", "precommit-fixture@example.invalid"]);
    git(sandbox, ["config", "user.name", "Precommit Fixture"]);
    fs.writeFileSync(path.join(sandbox, "package.json"), '{"private":true,"type":"module"}\n');
    git(sandbox, ["add", "package.json"]);
    git(sandbox, ["commit", "-qm", "fixture baseline"]);

    const good = "formatted.test.tsx";
    const untracked = "untracked.js";
    fs.writeFileSync(path.join(sandbox, good), 'export const Example=()=> <div>ready</div>\n');
    fs.writeFileSync(path.join(sandbox, untracked), "const  untracked=  true\n");
    git(sandbox, ["add", good]);
    const success = run("pnpm", ["exec", "lint-staged", "--cwd", sandbox, "--config", configPath, "--concurrent", "false"], root);
    assert.equal(success.status, 0, `lint-staged autofix failed:\n${success.stdout}\n${success.stderr}`);
    assert.match(fs.readFileSync(path.join(sandbox, good), "utf8"), /export const Example = \(\) => <div>ready<\/div>;/);
    assert.equal(fs.readFileSync(path.join(sandbox, untracked), "utf8"), "const  untracked=  true\n");
    assert.ok(git(sandbox, ["diff", "--cached", "--name-only"]).includes(good));

    const invalid = "unfixable.test.tsx";
    fs.writeFileSync(path.join(sandbox, invalid), 'export const Invalid = () => { const unused = 1; return <div>invalid</div>; };\n');
    git(sandbox, ["add", invalid]);
    const failed = run("pnpm", ["exec", "lint-staged", "--cwd", sandbox, "--config", configPath, "--concurrent", "false"], root);
    assert.notEqual(failed.status, 0, `unfixable unused-variable warning was accepted:\n${failed.stdout}\n${failed.stderr}`);
    assert.match(`${failed.stdout}\n${failed.stderr}`, /unused|warning|warnings|error/i);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
});
