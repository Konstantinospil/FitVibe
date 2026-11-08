#!/usr/bin/env node
"use strict";

// Investigation-only public audit: use the existing isolated E2E production
// ingress and real backend. The established blocking Lighthouse gate is not
// replaced by this diagnostic collection.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { publicRoutes } = require("./lighthouse-routes.cjs");
const { writePerformanceReport } = require("./lighthouse-performance-report.cjs");

const root = path.resolve(__dirname, "../..");
const outputDir = path.resolve(__dirname, "lhci-output/public-real");
const collectionDir = path.join(root, ".lighthouseci");
const canonical = JSON.parse(
  fs.readFileSync(path.join(__dirname, "lighthouserc.ci.json"), "utf8"),
);

const REQUIRED_API_PATHS = Object.freeze({
  "/": ["/api/v1/consent/cookie-status"],
  "/login": ["/api/v1/consent/cookie-status"],
  "/register": ["/api/v1/auth/register/options"],
  "/forgot-password": ["/api/v1/consent/cookie-status"],
  "/terms": ["/api/v1/legal/documents/terms"],
  "/privacy": ["/api/v1/legal/documents/privacy"],
  "/cookie": ["/api/v1/legal/documents/cookie"],
  "/contact": ["/api/v1/csrf-token"],
});

function publicConfigForOrigin(origin) {
  const base = new URL(origin);
  if (base.hostname !== "127.0.0.1" || base.protocol !== "http:") {
    throw new Error("Real-backend Lighthouse requires an isolated loopback HTTP ingress");
  }
  const source = canonical.ci.collect.url.map((value) => new URL(value).pathname).sort();
  if (JSON.stringify(source) !== JSON.stringify([...publicRoutes].sort())) {
    throw new Error("Canonical Lighthouse route inventory has drifted");
  }
  if (!Number.isInteger(canonical.ci.collect.numberOfRuns) ||
      canonical.ci.collect.numberOfRuns < 3) {
    throw new Error("Real-backend Lighthouse requires at least three runs");
  }
  return {
    ...canonical,
    ci: {
      ...canonical.ci,
      collect: {
        ...canonical.ci.collect,
        url: publicRoutes.map((pathname) => new URL(pathname, base).toString()),
      },
    },
  };
}

function assessPublicReport(report, pathname, origin) {
  const errors = [];
  const expected = new URL(pathname, origin).toString();
  const actual = report.finalDisplayedUrl || report.finalUrl;
  if (report.requestedUrl !== expected) {
    errors.push("wrong requested URL: " + report.requestedUrl);
  }
  if (!actual || new URL(actual).origin !== new URL(expected).origin ||
      new URL(actual).pathname !== pathname) {
    errors.push("redirected or replaced by " + String(actual));
  }
  if (report.runtimeError) errors.push("Lighthouse runtime error: " + report.runtimeError.message);
  for (const name of ["performance", "accessibility", "best-practices", "seo"]) {
    if (typeof report.categories?.[name]?.score !== "number") {
      errors.push("missing " + name + " score");
    }
  }

  const network = report.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(network)) {
    errors.push("missing network request evidence");
  }
  const api = Array.isArray(network) ? network.filter((item) => {
    try {
      const url = new URL(item.url);
      return url.origin === new URL(origin).origin && url.pathname.startsWith("/api/v1/");
    } catch {
      return false;
    }
  }) : [];
  for (const item of api) {
    if (typeof item.statusCode !== "number" || item.statusCode < 200 ||
        item.statusCode >= 400) {
      errors.push("backend " + String(item.statusCode) + " on " + new URL(item.url).pathname);
    }
  }
  for (const required of REQUIRED_API_PATHS[pathname] ?? []) {
    if (!api.some((item) => new URL(item.url).pathname === required &&
                    item.statusCode >= 200 && item.statusCode < 400)) {
      errors.push("missing successful backend response for " + required);
    }
  }
  const node = report.audits?.["lcp-breakdown-insight"]?.details?.items?.find(
    (item) => item.type === "node",
  );
  const lcpElement = node?.nodeLabel ?? null;
  if (["/terms", "/privacy", "/cookie"].includes(pathname) &&
      (lcpElement === "Error" || lcpElement === "common.error")) {
    errors.push("LCP measures legal-document error instead of content");
  }
  return { errors, lcpElement, apiRequests: api.length };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const results = [];
  const technicalErrors = [];
  const observations = [];
  let budgetErrors = [];
  let origin = process.env.PLAYWRIGHT_BASE_URL;
  const expectedRuns = canonical.ci.collect.numberOfRuns;
  try {
    if (!origin) throw new Error("PLAYWRIGHT_BASE_URL must select the real E2E ingress");
    const config = publicConfigForOrigin(origin);
    origin = new URL(origin).origin;

    // No new backend, fake API, or duplicated database: probe the existing
    // production-contract ingress and its seeded real-service dependencies.
    for (const endpoint of [
      "/api/v1/consent/cookie-status",
      "/api/v1/auth/register/options",
      "/api/v1/legal/documents/terms?language=en",
      "/api/v1/legal/documents/privacy?language=en",
      "/api/v1/legal/documents/cookie?language=en",
      "/api/v1/csrf-token",
    ]) {
      const response = await fetch(new URL(endpoint, origin), {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Real backend preflight " + endpoint +
        " returned HTTP " + response.status);
    }
    const runtimeConfig = path.join(outputDir, "lighthouserc.runtime.json");
    fs.writeFileSync(runtimeConfig, JSON.stringify(config, null, 2) + "\n");
    fs.rmSync(collectionDir, { recursive: true, force: true });

    const collected = spawnSync("pnpm", [
      "exec", "lhci", "collect", "--config=" + runtimeConfig,
    ], { cwd: root, stdio: "inherit", timeout: 14 * 60 * 1000 });
    if (collected.status !== 0) {
      technicalErrors.push("Lighthouse collection failed: " +
        (collected.error?.message || "exit " + String(collected.status)));
    }

    const files = fs.existsSync(collectionDir)
      ? fs.readdirSync(collectionDir).filter((name) => /^lhr-.*\.json$/.test(name))
      : [];
    for (const filename of files) {
      const report = JSON.parse(fs.readFileSync(path.join(collectionDir, filename), "utf8"));
      fs.copyFileSync(path.join(collectionDir, filename), path.join(outputDir, filename));
      const requested = report.requestedUrl;
      const pathname = publicRoutes.find((p) => new URL(p, origin).toString() === requested);
      if (pathname === undefined) {
        technicalErrors.push(filename + ": unexpected report URL " + requested);
        continue;
      }
      const diagnostic = assessPublicReport(report, pathname, origin);
      observations.push({ path: pathname, file: filename, ...diagnostic });
      if (diagnostic.errors.length) {
        technicalErrors.push(...diagnostic.errors.map(
          (error) => pathname + " (" + filename + "): " + error,
        ));
      }
      results.push({ path: pathname, report, valid: diagnostic.errors.length === 0 });
    }

    for (const pathname of publicRoutes) {
      const count = results.filter((item) => item.path === pathname && item.valid).length;
      if (count !== expectedRuns) {
        technicalErrors.push(pathname + ": expected " + expectedRuns +
          " valid runs, got " + count);
      }
    }

    // Display canonical pessimistic assertions without converting this
    // investigation-only collection into a replacement for the required gate.
    if (files.length > 0) {
      const asserted = spawnSync("pnpm", [
        "exec", "lhci", "assert", "--config=" + runtimeConfig,
      ], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
      fs.writeFileSync(path.join(outputDir, "assertions.log"),
        (asserted.stdout ?? "") + (asserted.stderr ?? ""));
      if (asserted.status !== 0) {
        budgetErrors = ["Canonical pessimistic budget assertions failed; see assertions.log"];
      }
    }
  } catch (error) {
    technicalErrors.push("Real-backend public Lighthouse setup: " + error.message);
  } finally {
    fs.writeFileSync(path.join(outputDir, "observations.json"),
      JSON.stringify(observations, null, 2) + "\n");
    const summary = writePerformanceReport(outputDir, {
      label: "Public pages through production-contract ingress (diagnostic)",
      paths: publicRoutes,
      results,
      expectedRuns,
      technicalErrors,
      budgetErrors,
    });
    console.log("Real-backend public Lighthouse: " + summary.measuredPages +
      "/" + summary.expectedPages + " complete pages. See " + outputDir);
    if (technicalErrors.length) {
      console.error(technicalErrors.join("\n"));
      process.exitCode = 1;
    }
    if (budgetErrors.length) console.warn(budgetErrors.join("\n"));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { publicConfigForOrigin, assessPublicReport };
