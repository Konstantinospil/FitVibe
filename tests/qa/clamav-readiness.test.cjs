const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const paths = [
  "infra/docker/prod/compose.yml",
  "infra/docker/staging/docker-compose.staging.yml",
  "infra/docker/test/docker-compose.test.yml",
  "infra/docker/dev/clamav.standalone.yml",
  ".github/workflows/ci.yml",
  "scripts/run-ci-local.sh",
];

const command = 'reply="$(printf \'PING\\n\' | nc -w 3 127.0.0.1 3310)" && test "$reply" = "PONG"';

function daemonResponds(reply, exitCode = 0) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clamav-ready-"));
  try {
    const fakeNc = path.join(dir, "nc");
    fs.writeFileSync(fakeNc, '#!/bin/sh\ncat >/dev/null\nprintf "%s" "$MOCK_REPLY"\nexit "$MOCK_EXIT"\n', { mode: 0o755 });
    const result = spawnSync("sh", ["-c", command], {
      env: { ...process.env, PATH: dir + path.delimiter + process.env.PATH, MOCK_REPLY: reply, MOCK_EXIT: String(exitCode) },
      encoding: "utf8",
    });
    assert.equal(result.error, undefined);
    return result.status === 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("ClamAV readiness requires a successful PONG", () => {
  assert.equal(daemonResponds("PONG"), true);
  assert.equal(daemonResponds(""), false);
  assert.equal(daemonResponds("ERROR"), false);
  assert.equal(daemonResponds("PONG", 1), false);
});

test("all ClamAV deployment contexts use protocol readiness, not binary version", () => {
  for (const filename of paths) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotMatch(source, /clamdscan\s+--version/, filename);
    assert.match(source, /PING/, filename);
    assert.match(source, /PONG/, filename);
    assert.match(source, /nc -w 3 127\.0\.0\.1 3310/, filename);
  }
});
