"use strict";

// Diagnostic-only Chrome event-level CPU trace. All timings are kept; URLs,
// credentials, response bodies, stacks and raw CDP args are never persisted.
const fs = require("node:fs");
const path = require("node:path");
const { getPageReadySelector } = require("./lighthouse-page-readiness.cjs");
const { analyzeCpuProfile } = require("./chrome-cpu-profile.cjs");

const routes = ["/terms", "/dashboard", "/calendar"];
const TRACE_CATEGORIES = "devtools.timeline,v8,blink.user_timing,loading";
const LONG_TASK_US = 50000;

function sanitizeTraceEvents(trace) {
  if (!trace || !Array.isArray(trace.traceEvents)) throw new Error("Missing Chrome trace events");
  return trace.traceEvents.filter((event) =>
    event && typeof event.name === "string" &&
    ["X", "B", "E", "I", "i"].includes(event.ph) &&
    Number.isFinite(event.ts) &&
    /^[a-zA-Z][a-zA-Z0-9._:-]{0,95}$/.test(event.name),
  ).map(({ name, cat, ph, ts, dur, pid, tid }) => ({
    name, category: typeof cat === "string" ? cat.slice(0, 100) : "",
    phase: ph, timestampUs: ts, ...(Number.isFinite(dur) ? { durationUs: dur } : {}),
    pid, tid,
  }));
}

function summarizeTrace(trace, navigation) {
  const events = sanitizeTraceEvents(trace);
  const timed = events.filter((event) => event.phase === "X" && event.durationUs > 0);
  const grouped = new Map();
  for (const event of timed) {
    const record = grouped.get(event.name) || { name: event.name, count: 0, totalDurationMs: 0, maxDurationMs: 0 };
    record.count += 1;
    record.totalDurationMs += event.durationUs / 1000;
    record.maxDurationMs = Math.max(record.maxDurationMs, event.durationUs / 1000);
    grouped.set(event.name, record);
  }
  return {
    navigation,
    eventCount: events.length,
    // Categories overlap and nest. These totals are diagnostic, not additive
    // estimates of exclusive CPU usage.
    topEventTypes: [...grouped.values()].sort((a, b) => b.totalDurationMs - a.totalDurationMs).slice(0, 25),
    longEvents: timed.filter((event) => event.durationUs >= LONG_TASK_US)
      .sort((a, b) => b.durationUs - a.durationUs).slice(0, 40),
    events,
  };
}

async function captureTrace(session, navigate) {
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await session.send("Profiler.enable");
  await session.send("Profiler.setSamplingInterval", { interval: 1000 });
  await session.send("Profiler.start");
  let startedTracing = false;
  let profile;
  let stream;
  let error;
  try {
    await session.send("Tracing.start", {
      categories: TRACE_CATEGORIES,
      transferMode: "ReturnAsStream",
    });
    startedTracing = true;
    await navigate();
  } catch (cause) {
    error = cause;
  } finally {
    try {
      const result = await session.send("Profiler.stop");
      profile = result.profile;
    } catch (cause) {
      error ||= cause;
    }
    if (startedTracing) {
      try {
        const complete = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Chrome trace timeout")), 30000);
          session.once("Tracing.tracingComplete", (result) => {
            clearTimeout(timeout);
            resolve(result);
          });
        });
        await session.send("Tracing.end");
        stream = (await complete).stream;
      } catch (cause) {
        error ||= cause;
      }
    }
    await session.send("Profiler.disable").catch(() => undefined);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  if (!stream) throw new Error("Chrome returned no tracing stream");
  let json = "";
  try {
    for (;;) {
      const response = await session.send("IO.read", { handle: stream });
      json += response.base64Encoded
        ? Buffer.from(response.data, "base64").toString("utf8")
        : response.data;
      if (response.eof) break;
      if (json.length > 75 * 1024 * 1024) throw new Error("Trace exceeded diagnostic size limit");
    }
  } finally {
    await session.send("IO.close", { handle: stream }).catch(() => undefined);
  }
  if (error) throw error;
  return { trace: JSON.parse(json), profile };
}

async function installObservedLcp(page) {
  await page.addInitScript(() => {
    window.__fitvibeTraceLcp = null;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__fitvibeTraceLcp = entry.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
}

async function timedNavigation({ context, origin, authFlag, route, kind }) {
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  try {
    if (authFlag) await page.addInitScript((key) => sessionStorage.setItem(key, "1"), authFlag);
    await installObservedLcp(page);
    await session.send("Network.enable");
    if (kind === "cold") await session.send("Network.clearBrowserCache");
    const start = Date.now();
    const { trace, profile } = await captureTrace(session, async () => {
      await page.goto(origin + route, { waitUntil: "domcontentloaded" });
      await page.locator(route === "/login" ? 'input[type="password"]' : getPageReadySelector(route))
        .first().waitFor({ state: "visible", timeout: 30000 });
      if (route !== "/login") {
        if (new URL(page.url()).pathname !== route) throw new Error("Authenticated route redirected");
        if (await page.locator(".cookie-consent-backdrop:visible").count()) {
          throw new Error("Consent overlay invalidated trace");
        }
      }
    });
    const timing = await page.evaluate(() => ({
      fcpMs: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      observedLcpMs: window.__fitvibeTraceLcp ?? null,
      navigationResponseEndMs: performance.getEntriesByType("navigation")[0]?.responseEnd ?? null,
      appMarks: performance.getEntriesByType("mark")
        .filter((e) => e.name.startsWith("fitvibe:"))
        .map((e) => ({ name: e.name, startTime: e.startTime })),
    }));
    return {
      ...summarizeTrace(trace, { route, kind, cpuThrottle: 4, network: "unthrottled",
        elapsedWallMs: Date.now() - start, ...timing }),
      cpuProfile: analyzeCpuProfile(profile, origin),
    };
  } finally {
    await session.detach().catch(() => undefined);
    await page.close().catch(() => undefined);
  }
}

async function timedSpaTransition({ context, origin, authFlag }) {
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  try {
    await page.addInitScript((key) => sessionStorage.setItem(key, "1"), authFlag);
    await page.goto(origin + "/dashboard", { waitUntil: "domcontentloaded" });
    await page.locator(getPageReadySelector("/dashboard"))
      .waitFor({ state: "visible", timeout: 30000 });
    const start = Date.now();
    const trace = await captureTrace(session, async () => {
      // A real React Router link click, not history.pushState or a full reload.
      await page.locator('a[href="/calendar"]').first().click();
      await page.locator(getPageReadySelector("/calendar"))
        .waitFor({ state: "visible", timeout: 30000 });
      if (new URL(page.url()).pathname !== "/calendar") {
        throw new Error("SPA transition did not reach Calendar");
      }
    });
    const marks = await page.evaluate(() => performance.getEntriesByType("mark")
      .filter((e) => e.name.startsWith("fitvibe:"))
      .map((e) => ({ name: e.name, startTime: e.startTime })));
    return {
      ...summarizeTrace(trace, { route: "/dashboard→/calendar", kind: "spa",
        cpuThrottle: 4, network: "unthrottled",
        elapsedWallMs: Date.now() - start, appMarks: marks,
        // Navigation LCP is not a metric of client-side route transitions.
        observedLcpMs: null }),
      cpuProfile: analyzeCpuProfile(profile, origin),
    };
  } finally {
    await session.detach().catch(() => undefined);
    await page.close().catch(() => undefined);
  }
}

async function runChromeCriticalPathDiagnostics({ browser, origin, authFlag, outputDir }) {
  fs.mkdirSync(outputDir, { recursive: true });
  const reports = [];
  const errors = [];
  const authenticated = browser.contexts()[0];
  for (const route of routes) {
    for (const kind of ["cold", "warm"]) {
      try {
        reports.push(await timedNavigation({
          context: authenticated, origin, authFlag, route, kind,
        }));
      } catch (error) {
        errors.push({ route, kind, error: error.message });
      }
    }
  }
  try {
    reports.push(await timedSpaTransition({ context: authenticated, origin, authFlag }));
  } catch (error) {
    errors.push({ route: "/dashboard→/calendar", kind: "spa", error: error.message });
  }
  const publicContext = await browser.newContext();
  try {
    for (const kind of ["cold", "warm"]) {
      try {
        reports.push(await timedNavigation({ context: publicContext, origin,
          authFlag: null, route: "/login", kind }));
      } catch (error) {
        errors.push({ route: "/login", kind, error: error.message });
      }
    }
  } finally {
    await publicContext.close();
  }
  fs.writeFileSync(path.join(outputDir, "chrome-critical-path.json"),
    JSON.stringify({ version: 1, reports, errors }, null, 2));
  console.log("Chrome critical-path diagnostics: " + reports.length + "/9 traces; " +
    errors.length + " errors");
  // Diagnostic errors are reported and visible; they never mask or relax
  // the authoritative authenticated Lighthouse budget.
  return { reports: reports.length, errors };
}

module.exports = { sanitizeTraceEvents, summarizeTrace, runChromeCriticalPathDiagnostics };
