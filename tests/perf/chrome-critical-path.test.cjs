"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { sanitizeTraceEvents, summarizeTrace } = require("./chrome-critical-path.cjs");

test("retains CPU event timings but never trace args, URLs, cookies or stack frames", () => {
  const result = sanitizeTraceEvents({ traceEvents: [
    { name: "EvaluateScript", cat: "devtools.timeline", ph: "X", ts: 1200,
      dur: 65000, pid: 42, tid: 6,
      args: { data: { url: "http://private.local/?access_token=secret",
        stackTrace: [{ functionName: "private" }], cookie: "secret" } } },
    { name: "invalid name with secret=token", ph: "X", ts: 2000, dur: 2 },
  ] });
  assert.equal(result.length, 1);
  assert.equal(result[0].durationUs, 65000);
  assert.equal(result[0].name, "EvaluateScript");
  assert.doesNotMatch(JSON.stringify(result), /secret|private|cookie|access_token|stackTrace/);
});

test("reports long CPU events and non-additive event-name aggregation", () => {
  const report = summarizeTrace({ traceEvents: [
    { name: "RunTask", ph: "X", ts: 1000, dur: 90000, cat: "devtools.timeline", pid: 1, tid: 2 },
    { name: "EvaluateScript", ph: "X", ts: 2000, dur: 60000, cat: "v8", pid: 1, tid: 2 },
    { name: "RunTask", ph: "X", ts: 100000, dur: 10000, cat: "devtools.timeline", pid: 1, tid: 2 },
  ] }, { route: "/terms", kind: "cold" });
  assert.deepEqual(report.longEvents.map((event) => event.durationUs), [90000, 60000]);
  assert.equal(report.topEventTypes[0].name, "RunTask");
  assert.equal(report.topEventTypes[0].totalDurationMs, 100);
  assert.equal(report.navigation.kind, "cold");
});

test("rejects absent trace evidence instead of manufacturing an empty success", () => {
  assert.throws(() => sanitizeTraceEvents(null), /Missing Chrome trace events/);
  assert.throws(() => sanitizeTraceEvents({}), /Missing Chrome trace events/);
});
