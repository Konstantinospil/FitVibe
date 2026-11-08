#!/usr/bin/env node
"use strict";

/**
 * Isolated SSR diagnostic only. No backend is running in this job, so neither
 * browser scores nor client-side route readiness are claimed here.
 * The real-backend Lighthouse runners own full-page performance budgets.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "../..");
const outputDir = path.join(__dirname, "lhci-output/ssr");
const origin = "http://127.0.0.1:4173";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validateSsrSample(sample, expectedCache) {
  const errors = [];
  if (sample.status !== 200) errors.push("SSR response status is not 200");
  if (!/<html\b/i.test(sample.body) || !/id="root"/.test(sample.body)) {
    errors.push("SSR response has no rendered HTML/root");
  }
  if (!sample.headers["content-security-policy"]) errors.push("SSR CSP header missing");
  if (sample.headers["x-content-type-options"] !== "nosniff") {
    errors.push("SSR nosniff header missing");
  }
  if (!Number.isFinite(Number.parseFloat(sample.headers["x-ssr-time"]))) {
    errors.push("SSR rendering timing header missing");
  }
  if (expectedCache && sample.headers["x-cache"] !== expectedCache) {
    errors.push("Expected SSR cache " + expectedCache + ", got " +
      String(sample.headers["x-cache"]));
  }
  if (!Number.isFinite(sample.ttfbMs) || sample.ttfbMs < 0 ||
      !Number.isFinite(sample.totalMs) || sample.totalMs < sample.ttfbMs) {
    errors.push("Invalid SSR timing measurements");
  }
  return errors;
}

function discoverAssets(html) {
  const assets = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/gi)) {
    const href = match[1];
    if (!/^\/(assets|fonts)\//.test(href) || !/\.(?:js|css)(?:\?|$)/.test(href)) {
      continue;
    }
    assets.add(href);
  }
  return [...assets];
}

async function sampleUrl(url) {
  const start = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const ttfbMs = performance.now() - start;
  const body = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body,
    ttfbMs: Number(ttfbMs.toFixed(2)),
    totalMs: Number((performance.now() - start).toFixed(2)),
  };
}

async function waitForServer(child, getLaunchError) {
  const start = performance.now();
  for (let i = 0; i < 100; i += 1) {
    if (getLaunchError()) throw getLaunchError();
    if (child.exitCode !== null) {
      throw new Error("SSR process exited before /health became ready");
    }
    try {
      const response = await fetch(origin + "/health", {
        signal: AbortSignal.timeout(750),
      });
      if (response.status === 200) return Number((performance.now() - start).toFixed(2));
    } catch {
      // The process is still starting.
    }
    await sleep(200);
  }
  throw new Error("SSR /health did not become ready");
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const result = {
    kind: "isolated-ssr-only",
    authoritativeFullPageLighthouse: false,
    startupMs: null,
    samples: {},
    assets: [],
    errors: [],
    notes: [
      "No backend: Lighthouse performance scores are not collected.",
      "Cold render is the first uncached-route request after /health.",
      "Production pre-generated public HTML can produce a cache HIT on the first /login request.",
      "Cache MISS for pre-generated pages is not forced by mutating built assets.",
    ],
  };
  let child;
  let launchError;
  let logTail = "";
  try {
    child = spawn("pnpm", ["--filter", "@fitvibe/frontend", "start:ssr"], {
      cwd: root,
      env: { ...process.env, NODE_ENV: "production", PORT: "4173" },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("error", (error) => { launchError = error; });
    for (const stream of [child.stdout, child.stderr]) {
      stream?.on("data", (chunk) => {
        logTail = (logTail + String(chunk)).slice(-2000);
      });
    }
    result.startupMs = await waitForServer(child, () => launchError);
    for (const [label, route] of [
      ["cold-render", "/contact"],
      ["warm-render", "/contact"],
      ["cache-first", "/login"],
      ["cache-repeat", "/login"],
    ]) {
      const sample = await sampleUrl(origin + route);
      result.samples[label] = {
        status: sample.status, headers: {
          "x-cache": sample.headers["x-cache"] ?? null,
          "x-ssr-time": sample.headers["x-ssr-time"] ?? null,
          "cache-control": sample.headers["cache-control"] ?? null,
        },
        ttfbMs: sample.ttfbMs, totalMs: sample.totalMs,
      };
      const expectedCache = label === "cache-repeat" ? "HIT" : null;
      result.errors.push(...validateSsrSample(sample, expectedCache)
        .map((error) => label + ": " + error));
      if (label === "cache-first") {
        const assets = discoverAssets(sample.body);
        if (!assets.some((asset) => /\.js(?:\?|$)/.test(asset))) {
          result.errors.push("SSR document did not reference built JavaScript");
        }
        for (const asset of assets) {
          const response = await fetch(new URL(asset, origin), {
            signal: AbortSignal.timeout(15000),
          });
          const contentType = response.headers.get("content-type") || "";
          const validType = /\.js(?:\?|$)/.test(asset)
            ? /javascript/.test(contentType) : /text\/css/.test(contentType);
          result.assets.push({ path: asset, status: response.status, contentType });
          if (response.status !== 200 || !validType) {
            result.errors.push("Unavailable or wrong MIME type for static asset " + asset);
          }
          await response.arrayBuffer();
        }
      }
    }
  } catch (error) {
    result.errors.push("SSR diagnostic execution: " + error.message);
    if (logTail) result.notes.push("SSR server log tail: " + logTail);
  } finally {
    if (child?.pid) {
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        // The isolated process has already exited.
      }
    }
    fs.writeFileSync(path.join(outputDir, "summary.json"),
      JSON.stringify(result, null, 2) + "\n");
    const lines = [
      "# Isolated production SSR diagnostics",
      "",
      "Not full-page Lighthouse evidence: backend services are absent.",
      "",
      "Startup to health: " + String(result.startupMs) + " ms",
      ...Object.entries(result.samples).map(([name, value]) =>
        "- " + name + ": TTFB " + value.ttfbMs + " ms, total " +
        value.totalMs + " ms, X-Cache " + String(value.headers["x-cache"]) +
        ", X-SSR-Time " + String(value.headers["x-ssr-time"])),
      "",
      "Verified static assets: " + result.assets.length,
      "Errors: " + result.errors.length,
      ...result.errors.map((error) => "- ERROR: " + error),
      "",
      ...result.notes.map((note) => "- " + note),
    ];
    fs.writeFileSync(path.join(outputDir, "summary.md"), lines.join("\n") + "\n");
    console.log(lines.join("\n"));
    if (result.errors.length) process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { validateSsrSample, discoverAssets };
