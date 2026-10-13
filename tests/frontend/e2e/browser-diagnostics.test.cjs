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
