"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { validateSsrSample, discoverAssets } = require("./run-ssr-diagnostics.cjs");

const root = path.resolve(__dirname, "../..");
const html = '<!doctype html><html><head><link rel="stylesheet" href="/assets/css/site.css"></head>' +
  '<body><div id="root">Rendered</div><script src="/assets/js/main.js"></script></body></html>';
function sample() {
  return {
    body: html, status: 200, ttfbMs: 12, totalMs: 18,
    headers: {
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "x-ssr-time": "5ms",
      "x-cache": "HIT",
    },
  };
}

test("SSR diagnostics distinguish cold/warm timing and cached HTML correctness", () => {
  assert.deepEqual(validateSsrSample(sample(), "HIT"), []);
  assert.deepEqual(discoverAssets(html), [
    "/assets/css/site.css", "/assets/js/main.js",
  ]);
  assert.match(validateSsrSample({ ...sample(), status: 404 }, "HIT").join("; "),
    /status is not 200/);
  assert.match(validateSsrSample({ ...sample(), body: "<html>Error</html>" }, "HIT").join("; "),
    /rendered HTML\/root/);
  assert.match(validateSsrSample({ ...sample(), headers: { ...sample().headers,
    "x-cache": "MISS" } }, "HIT").join("; "), /Expected SSR cache HIT/);
  assert.match(validateSsrSample({ ...sample(), headers: { ...sample().headers,
    "content-security-policy": "" } }).join("; "), /CSP header missing/);
  assert.match(validateSsrSample({ ...sample(), ttfbMs: NaN }).join("; "),
    /Invalid SSR timing/);
});

test("standalone CI measures SSR and never assigns backend-free Lighthouse scores", () => {
  const source = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  const job = source.match(/^  lighthouse:\n([\s\S]*?)(?=^  [a-z_]+:)/m)?.[1];
  assert.ok(job, "Authoritative lighthouse job id must remain owned");
  assert.match(job, /node tests\/perf\/run-ssr-diagnostics\.cjs/);
  assert.doesNotMatch(job, /lhci autorun|verify-lighthouse-coverage\.cjs/);
  const publicDiagnostic = source.match(
    /- name: Diagnose public Lighthouse through real E2E ingress\n\s+if: (.+)/,
  );
  assert.ok(publicDiagnostic);
  assert.equal(publicDiagnostic[1], "always() && matrix.shard == 1",
    "Authenticated Lighthouse failures must not suppress public evidence");
  assert.match(source, /name: Audit all ordinary authenticated athlete pages with Lighthouse/);
  const runner = fs.readFileSync(path.join(root, "tests/perf/run-lighthouse-public-real.cjs"), "utf8");
  assert.match(runner, /const scenarios = \["first-visit", "consented"\]/);
  assert.match(runner, /assertScenarioCoverage\(records, publicRoutes, scenarios, expectedRuns\)/);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"));
  assert.equal(config.ci.collect.numberOfRuns, 3);
  assert.deepEqual(Object.keys(config.ci.assert.assertions).sort(), [
    "categories:accessibility", "categories:best-practices",
    "categories:performance", "categories:seo",
    "largest-contentful-paint", "resource-summary:script.size",
  ]);
});
