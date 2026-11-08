"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { auditedRoutes, conditionalRoutes, backofficeRoutes, auditUrl } = require("./lighthouse-routes.cjs");
const { verifyRouteIdentity } = require("./lighthouse-report-contract.cjs");

const root = path.resolve(__dirname, "../..");
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"));
const pageIdentity = {
  categories: Object.fromEntries(
    ["performance", "accessibility", "best-practices", "seo"].map((name) => [name, { score: 0.8 }]),
  ),
};

test("Every declared frontend route has an audited or explicitly conditional scenario", () => {
  const keys = [...auditedRoutes, ...conditionalRoutes].map(({ mode, path }) => mode + ":" + path);
  assert.equal(new Set(keys).size, keys.length, "No duplicate scenarios");

  for (const [file, mode] of [
    ["apps/frontend/src/routes/PublicRoutes.tsx", "public"],
    ["apps/frontend/src/routes/ProtectedRoutes.tsx", "athlete"],
  ]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const paths = [...source.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)]
      .map((match) => match[1]).filter((value) => value !== "*" && !(mode === "athlete" && value === "/login"));
    paths.push("/");
    for (const segment of paths) {
      const pathname = segment === "/" ? segment : "/" + segment.replace(/^\//, "");
      assert.ok(keys.includes(mode + ":" + pathname), file + " has an unowned route " + pathname);
    }
  }
  assert.ok(conditionalRoutes.every((scenario) => scenario.fixture), "State-gated pages need a fixture requirement");
});


test("Every backoffice UI route is inventoried before expanding its Lighthouse environment", () => {
  const source = fs.readFileSync(path.join(root, "apps/backoffice/src/App.tsx"), "utf8");
  const declared = [...source.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)]
    .map((match) => match[1]).filter((value) => value !== "/");
  const known = new Set(backofficeRoutes.map((route) => route.path));
  for (const route of declared) {
    assert.ok(known.has("/" + route.replace(/^\//, "")), "Backoffice route is missing from inventory: " + route);
  }
  assert.equal(known.size, backofficeRoutes.length, "No duplicate backoffice paths");
});

test("Lighthouse login baseline remains a blocking three-run audit", () => {
  assert.deepEqual(
    [...config.ci.collect.url].sort(),
    [...new Set(require("./lighthouse-routes.cjs").publicRoutes)].map(
      (route) => new URL(route, "http://127.0.0.1:4173").toString(),
    ).sort(),
    "Each ordinary public page must be audited; do not silently replace pages with login",
  );
  assert.equal(config.ci.collect.numberOfRuns, 3);
});

test("Wrong or redirected Lighthouse pages cannot pass as the requested route", () => {
  const target = { mode: "athlete", path: "/calendar" };
  assert.throws(
    () => verifyRouteIdentity(target, {
      requestedUrl: auditUrl(target),
      finalDisplayedUrl: "http://127.0.0.1:4180/login",
      ...pageIdentity,
    }),
    /redirected or replaced/,
  );
  assert.throws(
    () => verifyRouteIdentity(target, {
      requestedUrl: auditUrl(target),
      finalDisplayedUrl: auditUrl(target),
      categories: { performance: { score: 0.8 } },
    }),
    /Missing Lighthouse/,
  );
  assert.doesNotThrow(() => verifyRouteIdentity(target, {
    requestedUrl: auditUrl(target),
    finalDisplayedUrl: auditUrl(target),
    ...pageIdentity,
  }));
});

test("Browser bootstrap allows every ordinary unauthenticated public audit route", () => {
  const source = fs.readFileSync(path.join(root, "apps/frontend/src/bootstrap.ts"), "utf8");
  const list = source.match(/const PUBLIC_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(list, "Expected the canonical bootstrap public route allow-list");
  const allowed = new Set([...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const { publicRoutes } = require("./lighthouse-routes.cjs");
  for (const route of publicRoutes) {
    assert.ok(allowed.has(route), "Bootstrap redirects declared public route to login: " + route);
  }
});

test("Authenticated Calendar preflight uses the real Calendar surface marker", () => {
  const selector = require("./lighthouse-page-readiness.cjs").getPageReadySelector("/calendar");
  assert.equal(selector, "main.calendar-surface[aria-labelledby='calendar-title']");
  const source = fs.readFileSync(path.join(root, "apps/frontend/src/pages/Calendar.tsx"), "utf8");
  assert.match(source, /<main className="training-page calendar-surface" aria-labelledby="calendar-title">/);
});
