"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  routeContracts,
  assertBackofficeInventory,
  verifyBackofficeContent,
  assessBackofficeReport,
  assertBackofficeAuditCoverage,
} = require("./lighthouse-backoffice-readiness.cjs");
const { backofficeRoutes, auditUrl } = require("./lighthouse-routes.cjs");
const { assertWorstRunBudgets } = require("./lighthouse-score-contract.cjs");

const origin = "http://127.0.0.1:4182";
const pathname = "/translations";
function reportFor(route, overrides = {}) {
  const api = routeContracts[route.path].api;
  const requests = [
    { url: origin + "/api/v1/csrf-token", statusCode: 200 },
    { url: origin + api, statusCode: 200 },
    { url: origin + "/api/v1/users/me", statusCode: route.path === "/login" ? 401 : 200 },
    { url: origin + "/assets/index.js", statusCode: 200 },
  ];
  return {
    requestedUrl: auditUrl(route, origin),
    finalDisplayedUrl: auditUrl(route, origin),
    categories: Object.fromEntries(
      ["performance", "accessibility", "best-practices", "seo"].map((name) => [
        name,
        { score: 0.95 },
      ]),
    ),
    audits: {
      "network-requests": { details: { items: requests } },
      "resource-summary": {
        details: { items: [{ resourceType: "script", transferSize: 2048, requestCount: 1 }] },
      },
      "largest-contentful-paint": { numericValue: 1200 },
    },
    ...overrides,
  };
}

test("All nine backoffice routes have their own state and readiness contract", () => {
  assert.doesNotThrow(assertBackofficeInventory);
  assert.deepEqual(
    Object.keys(routeContracts).sort(),
    backofficeRoutes.map((item) => item.path).sort(),
  );
  assert.equal(routeContracts["/superadmin/privileges"].mode, "backoffice-superadmin");
  assert.equal(routeContracts["/login"].mode, "backoffice-public");
});

test("Real backend 401, 403 and missing data cannot count as protected coverage", () => {
  const route = { mode: "backoffice-admin", path: pathname };
  const normal = reportFor(route);
  assert.deepEqual(assessBackofficeReport(normal, pathname, origin, { hasSession: true }), []);
  assert.match(
    assessBackofficeReport(normal, pathname, origin, { hasSession: false }).join(" "),
    /no verified session/,
  );
  const withoutMe = reportFor(route);
  withoutMe.audits["network-requests"].details.items = withoutMe.audits[
    "network-requests"
  ].details.items.filter((item) => !item.url.endsWith("/users/me"));
  assert.match(
    assessBackofficeReport(withoutMe, pathname, origin, { hasSession: true }).join(" "),
    /authorized/,
  );
  const denied = reportFor(route);
  denied.audits["network-requests"].details.items.find((item) =>
    item.url.endsWith("/translations"),
  ).statusCode = 403;
  assert.match(
    assessBackofficeReport(denied, pathname, origin, { hasSession: true }).join(" "),
    /403/,
  );
  assert.match(
    assessBackofficeReport(reportFor(route, { audits: {} }), pathname, origin, {
      hasSession: true,
    }).join(" "),
    /Missing Lighthouse network/,
  );
});

test("Anonymous login needs a real CSRF response and cannot reuse an admin session", () => {
  const route = backofficeRoutes.find((item) => item.path === "/login");
  const report = reportFor(route);
  assert.deepEqual(assessBackofficeReport(report, "/login", origin, { hasSession: false }), []);
  assert.match(
    assessBackofficeReport(report, "/login", origin, { hasSession: true }).join(" "),
    /anonymous/,
  );
  report.audits["network-requests"].details.items = report.audits[
    "network-requests"
  ].details.items.filter((item) => !item.url.endsWith("/csrf-token"));
  assert.match(
    assessBackofficeReport(report, "/login", origin, { hasSession: false }).join(" "),
    /CSRF|csrf-token/,
  );
});

test("Content-readiness requires the correct rendered state, not merely a matching URL", async () => {
  const calls = [];
  const page = {
    async waitForFunction(check, apiPath) {
      assert.equal(apiPath, routeContracts["/translations"].api);
      assert.equal(typeof check, "function");
    },
    locator(selector) {
      calls.push(selector);
      return {
        first() {
          return this;
        },
        async waitFor() {},
        async textContent() {
          return "Translations";
        },
        async count() {
          return 0;
        },
      };
    },
  };
  await verifyBackofficeContent(page, "/translations");
  assert.ok(calls.includes("main.backoffice-main h1"));
  await assert.rejects(
    verifyBackofficeContent(
      {
        async waitForFunction() {},
        locator(selector) {
          return {
            first() {
              return this;
            },
            async waitFor() {},
            async textContent() {
              return "";
            },
            async count() {
              return 0;
            },
          };
        },
      },
      "/translations",
    ),
    /empty rendered/,
  );
  await assert.rejects(verifyBackofficeContent(page, "/not-a-route"), /Missing backoffice/);
});

test("Missing, duplicated, invalid and preflight-only audits cannot masquerade as completion", () => {
  const scenarios = backofficeRoutes.map((route) => ({
    mode: route.mode,
    path: route.path,
  }));
  const records = scenarios.flatMap(({ mode, path }) =>
    [1, 2, 3].map((run) => ({
      id: mode + ":" + path + ":" + run,
      scenario: mode,
      pathname: path,
      valid: true,
      sameNavigationReady: true,
    })),
  );
  assert.deepEqual(assertBackofficeAuditCoverage(records, backofficeRoutes, 3), []);
  assert.match(
    assertBackofficeAuditCoverage(records.slice(1), backofficeRoutes, 3).join(" "),
    /expected 3 runs/,
  );
  assert.match(
    assertBackofficeAuditCoverage([...records, records[0]], backofficeRoutes, 3).join(" "),
    /Duplicate|expected 3 runs/,
  );
  assert.match(
    assertBackofficeAuditCoverage(
      records.map((r, i) => (i === 0 ? { ...r, sameNavigationReady: false } : r)),
      backofficeRoutes,
      3,
    ).join(" "),
    /same-navigation/,
  );
  assert.match(
    assertBackofficeAuditCoverage(
      records.map((r, i) => (i === 0 ? { ...r, valid: false } : r)),
      backofficeRoutes,
      3,
    ).join(" "),
    /same-navigation/,
  );
});

test("Worst-run budgets retain the canonical 3000 ms limit across admin route modes", () => {
  const route = { mode: "backoffice-admin", path: "/translations" };
  const assertion = {
    "largest-contentful-paint": [
      "error",
      {
        maxNumericValue: 3000,
        aggregationMethod: "pessimistic",
      },
    ],
  };
  const reports = [1200, 1300, 3100].map((lcp) =>
    reportFor(route, {
      audits: {
        ...reportFor(route).audits,
        "largest-contentful-paint": { numericValue: lcp },
      },
    }),
  );
  assert.match(
    assertWorstRunBudgets(reports, [route.path], origin, assertion, 3, route.mode).join(" "),
    /3100.*exceeds 3000/,
  );
  assert.deepEqual(
    assertWorstRunBudgets(reports.slice(0, 2), [route.path], origin, assertion, 3, route.mode)
      .length > 0,
    true,
  );
  assert.deepEqual(
    assertWorstRunBudgets(
      reports.map((r) => ({
        ...r,
        audits: { ...r.audits, "largest-contentful-paint": { numericValue: 1000 } },
      })),
      [route.path],
      origin,
      assertion,
      3,
      route.mode,
    ),
    [],
  );
});

test("Chrome cleanup waits for exit and tolerates a profile it cannot remove", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { EventEmitter } = require("node:events");
  const { stopChromeAndRemoveProfile } = require("./run-lighthouse-backoffice.cjs");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-backoffice-cleanup-test-"));
  fs.writeFileSync(path.join(profile, "Local State"), "{}");
  const signals = [];
  const chrome = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
    kill(signal) {
      signals.push(signal);
      // Chrome is still flushing its profile when it receives SIGTERM.
      setTimeout(() => {
        fs.writeFileSync(path.join(profile, "late-write"), "x");
        this.exitCode = 0;
        this.emit("exit", 0);
      }, 50);
    },
  });

  await stopChromeAndRemoveProfile(chrome, profile);
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.equal(fs.existsSync(profile), false);

  // An already-exited Chrome and a missing profile are both no-ops, not errors.
  await stopChromeAndRemoveProfile(chrome, profile);
  await stopChromeAndRemoveProfile(undefined, undefined);
});
