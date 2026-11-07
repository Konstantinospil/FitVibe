const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"));

test("Lighthouse CI gates every assertion on the worst of at least three runs", () => {
  assert.ok(config.ci.collect.numberOfRuns >= 3, "Collect at least three runs");

  const assertions = config.ci.assert.assertions;
  assert.ok(Object.keys(assertions).length > 0, "Lighthouse CI must have blocking assertions");
  for (const [name, [level, options]] of Object.entries(assertions)) {
    assert.equal(level, "error", `${name} must remain a blocking assertion`);
    assert.equal(
      options?.aggregationMethod,
      "pessimistic",
      `${name} must evaluate the worst result, not the default best result`,
    );
  }
});
