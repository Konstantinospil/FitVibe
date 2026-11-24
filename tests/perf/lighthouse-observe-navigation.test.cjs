"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { observeNavigation, isSafeApiPath } = require("./lighthouse-observe-navigation.cjs");

function makePage(initialUrl = "about:blank") {
  const page = new EventEmitter();
  const frame = { currentUrl: initialUrl, url() { return this.currentUrl; } };
  page.mainFrame = () => frame;
  page.url = () => frame.url();
  page.navigate = (url) => {
    frame.currentUrl = url;
    page.emit("framenavigated", frame);
  };
  return page;
}

test("observes the Lighthouse-created target and checks exactly its navigation", async () => {
  const context = new EventEmitter();
  const expected = "http://127.0.0.1:4180/library?lhci=athlete";
  const visited = [];
  const observer = observeNavigation(context, expected, async (page) => {
    assert.equal(page.url(), expected);
    visited.push(page.url());
  });
  const page = makePage();
  context.emit("page", page);
  page.navigate(expected);
  const result = await observer.finish();
  assert.deepEqual(visited, [expected]);
  assert.deepEqual(result, { requestedUrl: expected, ready: true, observedUrl: expected });
  assert.equal(context.listenerCount("page"), 0);
  assert.equal(page.listenerCount("framenavigated"), 0);
});

test("a preflight on a separate page cannot substitute for Lighthouse navigation", async () => {
  const context = new EventEmitter();
  const observer = observeNavigation(context, "http://127.0.0.1:4180/terms", async () => {});
  await assert.rejects(observer.finish(), /Missing or failed same-navigation/);
});

test("a wrong target, a redirected target and a loading failure cannot pass", async () => {
  const expected = "http://127.0.0.1:4180/terms";
  {
    const context = new EventEmitter();
    const observer = observeNavigation(context, expected, async () => {});
    const other = makePage();
    context.emit("page", other);
    other.navigate("http://127.0.0.1:4180/login");
    await assert.rejects(observer.finish(), /Missing or failed same-navigation/);
  }
  {
    const context = new EventEmitter();
    const observer = observeNavigation(context, expected, async () => {
      throw new Error("Legal document is still loading");
    });
    const page = makePage(expected);
    context.emit("page", page);
    await assert.rejects(observer.finish(), /Legal document is still loading/);
  }
  {
    const context = new EventEmitter();
    const observer = observeNavigation(context, expected, async (page) => {
      page.navigate("http://127.0.0.1:4180/login");
    });
    const page = makePage(expected);
    context.emit("page", page);
    await assert.rejects(observer.finish(), /navigated away/);
  }
});

test("duplicate Lighthouse tabs are not accepted as one measured navigation", async () => {
  const context = new EventEmitter();
  const expected = "http://127.0.0.1:4180/terms";
  const observer = observeNavigation(context, expected, async () => {});
  context.emit("page", makePage(expected));
  context.emit("page", makePage(expected));
  await assert.rejects(observer.finish(), /Missing or failed same-navigation/);
});

test("collects only whitelisted API statuses from the measured navigation", async () => {
  const context = new EventEmitter();
  const expected = "http://127.0.0.1:4180/terms?lhci=athlete";
  const page = makePage();
  const observer = observeNavigation(context, expected, async () => {}, async (_, responses) => ({
    readyAtMs: 1234,
    apiResponses: [...responses],
  }));
  context.emit("page", page);
  page.emit("response", { url: () => "http://127.0.0.1:4180/api/v1/auth/legal-documents/status",
    status: () => 200 });
  page.emit("response", { url: () => "http://127.0.0.1:4180/api/v1/users/secret-identifier",
    status: () => 200 });
  page.emit("response", { url: () => "https://other.example/api/v1/auth/legal-documents/status",
    status: () => 401 });
  page.navigate(expected);
  const result = await observer.finish();
  assert.deepEqual(result.diagnostics, {
    readyAtMs: 1234, apiResponses: [
      { path: "/api/v1/auth/legal-documents/status", status: 200 },
    ],
  });
  assert.equal(page.listenerCount("response"), 0);
  assert.equal(isSafeApiPath("/api/v1/users/secret-identifier"), false);
  assert.equal(isSafeApiPath("/api/v1/auth/legal-documents/status"), true);
});

test("diagnostic failure cannot turn a valid route into a failed Lighthouse observation", async () => {
  const context = new EventEmitter();
  const expected = "http://127.0.0.1:4180/dashboard";
  const page = makePage(expected);
  const observer = observeNavigation(context, expected, async () => {}, async () => {
    throw new Error("private diagnostic error must not leak");
  });
  context.emit("page", page);
  const result = await observer.finish();
  assert.equal(result.ready, true);
  assert.deepEqual(result.diagnostics, { diagnosticError: "Navigation timing unavailable" });
});

test("failed route readiness remains invalid even with diagnostics enabled", async () => {
  const context = new EventEmitter();
  const expected = "http://127.0.0.1:4180/calendar";
  const observer = observeNavigation(context, expected, async () => {
    throw new Error("route still loading");
  }, async () => ({ readyAtMs: 123 }));
  const page = makePage(expected);
  context.emit("page", page);
  await assert.rejects(observer.finish(), /route still loading/);
});
