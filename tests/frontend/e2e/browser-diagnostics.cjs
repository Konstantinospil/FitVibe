"use strict";

const assert = require("node:assert/strict");
const activeDiagnostics = new WeakMap();

function watchBrowser(page) {
  const diagnostics = {
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    apiHttpErrors: [],
    expectedApiHttpErrors: [],
  };
  const pathOf = (request) => new URL(request.url()).pathname;
  const apiRequest = (request) => pathOf(request).startsWith("/api/v1/");
  const isApiUrl = (url) => {
    try {
      return new URL(url).pathname.startsWith("/api/v1/");
    } catch {
      return false;
    }
  };
  const onPageError = (error) => diagnostics.pageErrors.push(error.message);
  const onConsole = (message) => {
    const type = message.type();
    if (type !== "error" && type !== "warning") return;
    const text = message.text();
    const url = message.location?.()?.url ?? "";
    // The browser reports every failed API response as "Failed to load
    // resource". The response and requestfailed checks below already judge
    // those (including registered expected errors), so don't count them twice.
    // Failed non-API resources (scripts, styles, images) still count.
    if (text.startsWith("Failed to load resource:") && isApiUrl(url)) return;
    const entry = url ? `${text} (${url})` : text;
    (type === "error" ? diagnostics.consoleErrors : diagnostics.consoleWarnings).push(entry);
  };
  const onRequestFailed = (request) => {
    if (!apiRequest(request)) return;
    const reason = request.failure()?.errorText ?? "unknown";
    if (!reason.includes("ERR_ABORTED")) {
      diagnostics.failedRequests.push(`${request.method()} ${pathOf(request)}: ${reason}`);
    }
  };
  const onResponse = (response) => {
    const request = response.request();
    if (!apiRequest(request) || response.status() < 400) return;
    // The login page legitimately asks for user state without a session.
    if (response.status() === 401 && pathOf(request) === "/api/v1/users/me") return;
    const expected = diagnostics.expectedApiHttpErrors.find(
      (entry) =>
        entry.method === request.method() &&
        entry.path === pathOf(request) &&
        entry.status === response.status() &&
        entry.observed === 0,
    );
    if (expected) {
      expected.observed += 1;
      return;
    }
    diagnostics.apiHttpErrors.push(`${request.method()} ${pathOf(request)}: ${response.status()}`);
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  const observer = {
    snapshot: () => diagnostics,
    expectApiHttpError(method, path, status) {
      assert.match(method, /^[A-Z]+$/, "Expected API method must be uppercase");
      assert.match(path, /^\/api\/v1\//, "Expected API path must be explicit");
      assert.ok(Number.isInteger(status) && status >= 400 && status < 600);
      assert.ok(
        !diagnostics.expectedApiHttpErrors.some(
          (entry) => entry.method === method && entry.path === path && entry.status === status,
        ),
        "Duplicate expected API error registration",
      );
      diagnostics.expectedApiHttpErrors.push({ method, path, status, observed: 0 });
    },
    assertHealthy() {
      assert.deepEqual(diagnostics.pageErrors, [], "Uncaught browser errors");
      // Production no longer hides console output (issue 663), so console
      // errors (app logging, CSP violations, failed assets) fail the test.
      // Warnings are recorded and attached to the report, but don't fail it.
      assert.deepEqual(diagnostics.consoleErrors, [], "Browser console errors");
      assert.deepEqual(diagnostics.failedRequests, [], "Unexpected API transport failures");
      assert.deepEqual(diagnostics.apiHttpErrors, [], "Unexpected API errors");
      assert.deepEqual(
        diagnostics.expectedApiHttpErrors.filter((entry) => entry.observed !== 1),
        [],
        "Expected API errors must be observed exactly once",
      );
    },
    stop() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
      activeDiagnostics.delete(page);
    },
  };
  activeDiagnostics.set(page, observer);
  return observer;
}
function expectApiHttpError(page, method, path, status) {
  const observer = activeDiagnostics.get(page);
  assert.ok(observer, "Browser diagnostics are not active for this page");
  observer.expectApiHttpError(method, path, status);
}
module.exports = { watchBrowser, expectApiHttpError };
