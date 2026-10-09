const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { observeMutation } = require("./request-observer.cjs");

function request() {
  return {
    method: () => "POST",
    url: () => "http://127.0.0.1:4180/api/v1/auth/register",
    failure: () => null,
  };
}

test("missing mutation is a failure", () => {
  const page = new EventEmitter();
  const observer = observeMutation(page, "POST", "/api/v1/auth/register");
  assert.throws(() => observer.assertExactlyOnce(202), /expected exactly one request/);
  observer.stop();
});

test("duplicate mutations are a failure even if both responses succeed", () => {
  const page = new EventEmitter();
  const observer = observeMutation(page, "POST", "/api/v1/auth/register");
  for (let i = 0; i < 2; i++) {
    const req = request();
    page.emit("request", req);
    page.emit("response", { request: () => req, status: () => 202 });
  }
  assert.throws(() => observer.assertExactlyOnce(202), /expected exactly one request/);
  observer.stop();
});

test("wrong response status fails", () => {
  const page = new EventEmitter();
  const observer = observeMutation(page, "POST", "/api/v1/auth/register");
  const req = request();
  page.emit("request", req);
  page.emit("response", { request: () => req, status: () => 409 });
  assert.throws(() => observer.assertExactlyOnce(202), /Unexpected mutation response status/);
  observer.stop();
});
