"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { safeSource, safeFunctionName, analyzeCpuProfile } = require("./chrome-cpu-profile.cjs");

const origin = "http://127.0.0.1:4180";

test("attribution includes application module locations, self time and inclusive time", () => {
  const profile = {
    nodes: [
      { id: 1, children: [2], callFrame: { functionName: "(root)", url: "", lineNumber: -1 } },
      { id: 2, children: [3], callFrame: {
        functionName: "renderCalendar", url: origin + "/assets/js/calendar-abc123.js",
        lineNumber: 20, columnNumber: 4,
      } },
      { id: 3, callFrame: {
        functionName: "calculateRows", url: origin + "/assets/js/calendar-abc123.js",
        lineNumber: 35, columnNumber: 8,
      } },
    ],
    samples: [3, 3, 2],
    timeDeltas: [1000, 2000, 3000],
  };
  const result = analyzeCpuProfile(profile, origin);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.sampledDurationMs, 6);
  const calendar = result.topBySelfTime.find((row) => row.functionName === "renderCalendar");
  const rows = result.topBySelfTime.find((row) => row.functionName === "calculateRows");
  assert.equal(calendar.source, "/assets/js/calendar-abc123.js");
  assert.equal(calendar.line, 21);
  assert.equal(calendar.column, 5);
  assert.equal(calendar.selfTimeMs, 3);
  assert.equal(calendar.inclusiveTimeMs, 6);
  assert.equal(rows.selfTimeMs, 3);
  assert.equal(rows.inclusiveTimeMs, 3);
  assert.equal(rows.samples, 2);
});

test("excludes external URLs, source query tokens, raw stacks and sensitive function labels", () => {
  const profile = {
    nodes: [
      { id: 1, children: [2], callFrame: { functionName: "privateValue=secret",
        url: "https://other.example/?token=secret", lineNumber: 1 } },
      { id: 2, callFrame: { functionName: "mount",
        url: origin + "/assets/js/index-abc.js?session=secret", lineNumber: 2 } },
    ],
    samples: [1, 2],
    timeDeltas: [1000, 1000],
  };
  const result = analyzeCpuProfile(profile, origin);
  assert.equal(safeSource(origin + "/private?session=secret", origin), "[non-app]");
  assert.equal(safeFunctionName("password=secret"), "[anonymous/unknown]");
  assert.doesNotMatch(JSON.stringify(result), /secret|session=|https:\/\/other\.example|privateValue/);
});

test("rejects invalid child edges in Chrome CPU call tree", () => {
  assert.throws(() => analyzeCpuProfile({
    nodes: [
      { id: 1, children: [2], callFrame: {} },
      { id: 3, callFrame: {} },
    ],
    samples: [1], timeDeltas: [1000],
  }, origin), /Invalid CPU profile call tree/);
});

test("invalid or missing profiler samples cannot silently create a successful result", () => {
  assert.throws(() => analyzeCpuProfile(null, origin), /Missing or inconsistent CPU samples/);
  assert.throws(() => analyzeCpuProfile({ nodes: [], samples: [1], timeDeltas: [] }, origin),
    /Missing or inconsistent CPU samples/);
  assert.throws(() => analyzeCpuProfile({
    nodes: [{ id: 1, callFrame: {} }], samples: [2], timeDeltas: [1000],
  }, origin), /Invalid CPU sample timing or node/);
});
