"use strict";

// Chrome DevTools CPU sampling profile analyzer. Sample times are estimates,
// not exact per-function wall time and not an additive trace-event breakdown.
// Persist only application asset paths and static function identifiers.
function safeSource(raw, origin) {
  if (typeof raw !== "string" || !raw) return "[unknown]";
  let url;
  try { url = new URL(raw); } catch { return "[non-app]"; }
  if (url.origin !== origin || !/^\/assets\/[a-zA-Z0-9_./-]+$/.test(url.pathname) ||
      url.pathname.includes("..")) return "[non-app]";
  return url.pathname;
}

function safeFunctionName(name) {
  return typeof name === "string" &&
    /^[a-zA-Z_$][a-zA-Z0-9_.$<> -]{0,95}$/.test(name)
    ? name : "[anonymous/unknown]";
}

function analyzeCpuProfile(profile, origin) {
  if (!profile || !Array.isArray(profile.nodes) || !Array.isArray(profile.samples) ||
      !Array.isArray(profile.timeDeltas) ||
      profile.samples.length !== profile.timeDeltas.length || !profile.samples.length) {
    throw new Error("Missing or inconsistent CPU samples");
  }
  const nodeById = new Map(profile.nodes.map((node) => [node.id, node]));
  const inclusive = new Map();
  const own = new Map();
  let totalSampleUs = 0;
  for (let i = 0; i < profile.samples.length; i += 1) {
    const delta = profile.timeDeltas[i];
    const id = profile.samples[i];
    if (!Number.isFinite(delta) || delta <= 0 || !nodeById.has(id)) {
      throw new Error("Invalid CPU sample timing or node");
    }
    totalSampleUs += delta;
    own.set(id, (own.get(id) || 0) + delta);
    let current = id;
    const seen = new Set();
    while (nodeById.has(current) && !seen.has(current)) {
      seen.add(current);
      inclusive.set(current, (inclusive.get(current) || 0) + delta);
      current = nodeById.get(current).parent;
    }
  }
  const totals = new Map();
  for (const node of profile.nodes) {
    const frame = node.callFrame || {};
    const source = safeSource(frame.url, origin);
    const functionName = safeFunctionName(frame.functionName);
    const line = Number.isInteger(frame.lineNumber) && source.startsWith("/assets/")
      ? frame.lineNumber + 1 : null;
    const column = Number.isInteger(frame.columnNumber) && source.startsWith("/assets/")
      ? frame.columnNumber + 1 : null;
    const key = JSON.stringify([source, functionName, line, column]);
    const row = totals.get(key) || { source, functionName, line, column,
      selfTimeMs: 0, inclusiveTimeMs: 0, samples: 0 };
    row.selfTimeMs += (own.get(node.id) || 0) / 1000;
    row.inclusiveTimeMs += (inclusive.get(node.id) || 0) / 1000;
    row.samples += profile.samples.filter((id) => id === node.id).length;
    totals.set(key, row);
  }
  const functions = [...totals.values()];
  // Inclusive times can overlap across recursion and frames.
  functions.sort((a, b) => b.selfTimeMs - a.selfTimeMs);
  const byInclusiveTime = [...functions].sort((a, b) => b.inclusiveTimeMs - a.inclusiveTimeMs);
  return {
    method: "Chrome DevTools Profiler sampling",
    sampleCount: profile.samples.length,
    sampledDurationMs: totalSampleUs / 1000,
    // No call stacks, full URLs, sample node IDs or source text persist.
    topBySelfTime: functions.slice(0, 60),
    topByInclusiveTime: byInclusiveTime.slice(0, 60),
  };
}

module.exports = { safeSource, safeFunctionName, analyzeCpuProfile };
