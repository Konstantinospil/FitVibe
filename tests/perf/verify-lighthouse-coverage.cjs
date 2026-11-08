"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { publicRoutes } = require("./lighthouse-routes.cjs");
const { writePerformanceReport } = require("./lighthouse-performance-report.cjs");

const root = path.resolve(__dirname, "../..");
const reportsDir = path.resolve(root, ".lighthouseci");
const outputDir = path.resolve(__dirname, "lhci-output/public");
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "lighthouserc.ci.json"), "utf8"));
const expected = new Map(publicRoutes.map((route) => [
  new URL(route, "http://127.0.0.1:4173").toString(), 0,
]));
const failures = [];
const results = [];

if (fs.existsSync(reportsDir)) {
  for (const filename of fs.readdirSync(reportsDir)) {
    if (!/^lhr-.*\.json$/.test(filename)) continue;
    const lhr = JSON.parse(fs.readFileSync(path.join(reportsDir, filename), "utf8"));
    const requested = lhr.requestedUrl;
    if (!expected.has(requested)) {
      failures.push(filename + ": unexpected audited URL " + requested);
      continue;
    }
    const target = new URL(requested);
    let valid = false;
    try {
      const final = new URL(lhr.finalDisplayedUrl || lhr.finalUrl);
      if (final.origin !== target.origin || final.pathname !== target.pathname) {
        throw new Error("audited route redirected or replaced: " + requested + " -> " + final);
      }
      if (lhr.runtimeError) throw new Error("Lighthouse runtime error: " + lhr.runtimeError.message);
      for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
        if (typeof lhr.categories?.[category]?.score !== "number") {
          throw new Error("Missing category " + category);
        }
      }
      valid = true;
      expected.set(requested, expected.get(requested) + 1);
    } catch (error) {
      failures.push(filename + ": " + error.message);
    }
    results.push({ path: target.pathname, report: lhr, valid });
  }
} else {
  failures.push("Lighthouse reports directory is missing: " + reportsDir);
}

for (const [url, count] of expected) {
  if (count !== config.ci.collect.numberOfRuns) {
    failures.push(url + ": expected " + config.ci.collect.numberOfRuns +
      " validated runs, observed " + count);
  }
}
const summary = writePerformanceReport(outputDir, {
  label: "Public routes",
  paths: publicRoutes,
  results,
  expectedRuns: config.ci.collect.numberOfRuns,
  technicalErrors: failures,
});
console.log("Public Lighthouse report: " + summary.measuredPages +
  "/" + summary.expectedPages + " complete pages. See " + outputDir + "/summary.md");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
