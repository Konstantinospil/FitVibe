"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { watchBrowser, expectApiHttpError } = require("./browser-diagnostics.cjs");

function setup() {
  const page = new EventEmitter();
  const observer = watchBrowser(page);
  const respond = (method, path, status) => {
    const request = {
      method: () => method,
      url: () => "http://127.0.0.1:4180" + path,
    };
    page.emit("response", { request: () => request, status: () => status });
  };
  return { page, observer, respond };
}

test("explicit 422 is accepted once and must occur", () => {
  const { page, observer, respond } = setup();
  expectApiHttpError(page, "PATCH", "/api/v1/users/me", 422);
  assert.throws(() => observer.assertHealthy(), /observed exactly once/);
  respond("PATCH", "/api/v1/users/me", 422);
  observer.assertHealthy();
  observer.stop();
});

test("duplicate 422 remains a failure", () => {
  const { page, observer, respond } = setup();
  expectApiHttpError(page, "PATCH", "/api/v1/users/me", 422);
  respond("PATCH", "/api/v1/users/me", 422);
  respond("PATCH", "/api/v1/users/me", 422);
  assert.throws(() => observer.assertHealthy(), /Unexpected API errors/);
  observer.stop();
});

test("unexpected status or endpoint remains a failure", () => {
  const { page, observer, respond } = setup();
  expectApiHttpError(page, "PATCH", "/api/v1/users/me", 422);
  respond("PATCH", "/api/v1/users/me", 500);
  respond("POST", "/api/v1/users/me", 422);
  assert.deepEqual(observer.snapshot().apiHttpErrors, [
    "PATCH /api/v1/users/me: 500",
    "POST /api/v1/users/me: 422",
  ]);
  assert.throws(() => observer.assertHealthy(), /Unexpected API errors/);
  observer.stop();
});

test("unregistered HTTP 422 is never globally ignored", () => {
  const { observer, respond } = setup();
  respond("PATCH", "/api/v1/users/me", 422);
  assert.throws(() => observer.assertHealthy(), /Unexpected API errors/);
  observer.stop();
});

function emitConsole(page, type, text, url = "") {
  page.emit("console", { type: () => type, text: () => text, location: () => ({ url }) });
}

test("application console errors fail the browser health check", () => {
  const { page, observer } = setup();
  emitConsole(page, "error", "[ERROR] Login error", "http://127.0.0.1:4180/assets/js/main.js");
  assert.throws(() => observer.assertHealthy(), /Browser console errors/);
  observer.stop();
});

test("CSP violations and failed non-API resources are console errors", () => {
  const { page, observer } = setup();
  emitConsole(
    page,
    "error",
    "Applying inline style violates the following Content Security Policy directive",
  );
  emitConsole(
    page,
    "error",
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
    "http://127.0.0.1:4180/assets/js/missing-chunk.js",
  );
  assert.equal(observer.snapshot().consoleErrors.length, 2);
  assert.throws(() => observer.assertHealthy(), /Browser console errors/);
  observer.stop();
});

test("browser resource messages for API responses are judged by the HTTP checks", () => {
  const { page, observer, respond } = setup();
  expectApiHttpError(page, "PATCH", "/api/v1/users/me", 422);
  respond("PATCH", "/api/v1/users/me", 422);
  emitConsole(
    page,
    "error",
    "Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)",
    "http://127.0.0.1:4180/api/v1/users/me",
  );
  assert.deepEqual(observer.snapshot().consoleErrors, []);
  observer.assertHealthy();
  observer.stop();
});

test("console warnings are recorded without failing the health check", () => {
  const { page, observer } = setup();
  emitConsole(page, "warning", "[WARN] [featureFlags] Failed to fetch config");
  emitConsole(page, "log", "ignored");
  assert.deepEqual(observer.snapshot().consoleWarnings, [
    "[WARN] [featureFlags] Failed to fetch config",
  ]);
  observer.assertHealthy();
  observer.stop();
});
