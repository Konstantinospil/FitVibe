"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { auditedRoutes, conditionalRoutes, auditUrl } = require("./lighthouse-routes.cjs");

const root = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"));

test("Lighthouse measures every ordinary frontend route and declares state-gated exceptions", () => {
  const expected = new Set([...auditedRoutes, ...conditionalRoutes].map(({ mode, path }) => mode + ":" + path));
  assert.equal(expected.size, auditedRoutes.length + conditionalRoutes.length, "No duplicate route scenarios");

  for (const [file, mode] of [
    ["apps/frontend/src/routes/PublicRoutes.tsx", "public"],
    ["apps/frontend/src/routes/ProtectedRoutes.tsx", "athlete"],
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const declared = [...source.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)]
      .map((match) => match[1]).filter((route) => route !== "*");
    // Index routes are the root route in both trees.
    declared.push("/");
    for (const segment of declared) {
      const pathname = segment === "/" ? segment : "/" + segment.replace(/^\//, "");
      assert.ok(expected.has(mode + ":" + pathname), file + " has an unowned route " + pathname);
    }
  }

  const configured = config.ci.collect.url;
  assert.deepEqual(
    [...configured].sort(),
    auditedRoutes.map((route) => auditUrl(route)).sort(),
    "The audited URL inventory and Lighthouse configuration must remain aligned",
  );
  assert.equal(config.ci.collect.numberOfRuns, 3);
});

test("Protected page audits fail closed if the result lands on login", () => {
  const { verifyRouteIdentity } = require("./lighthouse-report-contract.cjs");
  const target = { mode: "athlete", path: "/calendar" };
  assert.throws(
    () => verifyRouteIdentity(target, { requestedUrl: auditUrl(target), finalDisplayedUrl: "http://127.0.0.1:4180/login" }),
    /redirected or replaced/,
  );
  assert.doesNotThrow(() => verifyRouteIdentity(target, {
    requestedUrl: auditUrl(target),
    finalDisplayedUrl: auditUrl(target),
  }));
});
