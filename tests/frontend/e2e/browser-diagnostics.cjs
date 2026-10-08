"use strict";

const assert = require("node:assert/strict");

function watchBrowser(page) {
  const diagnostics = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    apiHttpErrors: [],
  };
  const pathOf = (request) => new URL(request.url()).pathname;
  const apiRequest = (request) => pathOf(request).startsWith("/api/v1/");
  const onPageError = (error) => diagnostics.pageErrors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
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
    diagnostics.apiHttpErrors.push(
      `${request.method()} ${pathOf(request)}: ${response.status()}`,
    );
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return {
    snapshot: () => diagnostics,
    assertHealthy() {
      assert.deepEqual(diagnostics.pageErrors, [], "Uncaught browser errors");
      assert.deepEqual(diagnostics.failedRequests, [], "Unexpected API transport failures");
      assert.deepEqual(diagnostics.apiHttpErrors, [], "Unexpected API errors");
    },
    stop() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}
module.exports = { watchBrowser };
