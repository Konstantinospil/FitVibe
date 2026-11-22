#!/usr/bin/env node
"use strict";
// #614: real backoffice audits share shard 1's disposable backend/database.
// Never run against an external or deployed database. No role/API mocks.
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");
const { chromium } = require("@playwright/test");
const { backofficeRoutes, auditUrl } = require("./lighthouse-routes.cjs");
const { verifyRouteIdentity } = require("./lighthouse-report-contract.cjs");
const { scriptTransfer, networkRequests } = require("./lighthouse-measurement-validity.cjs");
const { observeNavigation } = require("./lighthouse-observe-navigation.cjs");
const { assertWorstRunBudgets } = require("./lighthouse-score-contract.cjs");
const { writePerformanceReport } = require("./lighthouse-performance-report.cjs");
const {
  routeContracts, verifyBackofficeContent, assessBackofficeReport,
  assertBackofficeAuditCoverage,
} = require("./lighthouse-backoffice-readiness.cjs");

const { authenticator } = createRequire(path.resolve(__dirname, "../../apps/backend/package.json"))(
  "@otplib/preset-default",
);
const origin = process.env.PLAYWRIGHT_BACKOFFICE_URL || "http://127.0.0.1:4182";
const outputDir = path.resolve(__dirname, "lhci-output/backoffice");
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "lighthouserc.ci.json"), "utf8"));
const numberOfRuns = config.ci.collect.numberOfRuns;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertDisposableRuntime() {
  const database = new URL(process.env.DATABASE_URL || "postgres://invalid/invalid");
  const address = new URL(origin);
  if (process.env.LIGHTHOUSE_STATEFUL_FIXTURES !== "1" ||
      process.env.CI !== "true" || process.env.NODE_ENV !== "development" ||
      address.hostname !== "127.0.0.1" || address.port !== "4182" ||
      database.hostname !== "127.0.0.1" || database.pathname !== "/fitvibe_e2e") {
    throw new Error("Backoffice Lighthouse requires the dedicated disposable CI E2E runtime");
  }
  if (!Number.isInteger(numberOfRuns) || numberOfRuns < 3) {
    throw new Error("Backoffice Lighthouse requires three or more independent runs");
  }
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForDebugger(port, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Chrome exited before CDP startup");
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (response.ok) {
        const data = await response.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome has not bound its debugger.
    }
    await delay(500);
  }
  throw new Error("Backoffice Chrome debugger never became ready");
}

async function csrf(request) {
  const response = await request.get(origin + "/api/v1/csrf-token");
  if (!response.ok()) throw new Error("Unable to retrieve real CSRF token: HTTP " + response.status());
  const token = (await response.json()).csrfToken;
  if (!token) throw new Error("Real backend did not return a CSRF token");
  return token;
}

async function post(request, route, data) {
  const response = await request.post(origin + route, {
    data, headers: { Origin: origin, "X-CSRF-Token": await csrf(request) },
  });
  if (!response.ok()) throw new Error(route + " failed with HTTP " + response.status());
  return response.json().catch(() => ({}));
}

async function confirmRole(request, role) {
  const response = await request.get(origin + "/api/v1/users/me");
  if (!response.ok()) throw new Error("Privileged browser session not accepted: HTTP " + response.status());
  const identity = await response.json();
  if (identity.role !== role || identity.primaryEmail !== "admin@fitvibe.local") {
    throw new Error("Privileged session has an unexpected persisted user or role");
  }
}

async function enrollAdministrator(request) {
  const first = await post(request, "/api/v1/auth/login", {
    email: "admin@fitvibe.local", password: process.env.ADMIN_PASSWORD,
  });
  if (first.requires2FA !== false || first.user?.role !== "admin") {
    throw new Error("Expected the disposable seeded admin without MFA enrollment");
  }
  const setup = await request.get(origin + "/api/v1/auth/2fa/setup");
  if (!setup.ok()) throw new Error("Real administrator MFA setup failed: HTTP " + setup.status());
  const { secret, backupCodes } = await setup.json();
  if (!secret || !Array.isArray(backupCodes) || backupCodes.length < 2) {
    throw new Error("Administrator enrollment returned incomplete MFA credentials");
  }
  // The backend owns the TOTP policy; never store or report the ephemeral secret.
  await post(request, "/api/v1/auth/2fa/enable", {
    code: authenticator.generate(secret),
  });
  const status = await request.get(origin + "/api/v1/auth/2fa/status");
  if (!status.ok() || !(await status.json()).enabled) {
    throw new Error("Administrator MFA enrollment was not persisted");
  }
  await post(request, "/api/v1/auth/logout", {});
  return backupCodes;
}

async function signInWithMfa(request, expectedRole, backupCode) {
  const login = await post(request, "/api/v1/auth/login", {
    email: "admin@fitvibe.local", password: process.env.ADMIN_PASSWORD,
  });
  if (!login.requires2FA || !login.pendingSessionId) {
    throw new Error("Privileged login did not require the real MFA challenge");
  }
  const verified = await post(request, "/api/v1/auth/login/verify-2fa", {
    pendingSessionId: login.pendingSessionId, code: backupCode,
  });
  if (verified.user?.role !== expectedRole) throw new Error("MFA result has the wrong role");
  await confirmRole(request, expectedRole);
}

async function promoteDisposableAdmin() {
  // Uses the repository's audited bootstrap command; no direct role SQL update.
  // The command atomically promotes the MFA-verified admin and revokes its sessions.
  const child = spawn("pnpm", ["--filter", "@fitvibe/backend", "auth:bootstrap-superadmin"], {
    cwd: path.resolve(__dirname, "../.."),
    env: {
      ...process.env,
      SUPERADMIN_USERNAME: "admin",
      SUPERADMIN_BOOTSTRAP_REASON: "Disposable Lighthouse issue 614 fixture",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (bytes) => { output += bytes.toString().slice(0, 4000); });
  }
  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  if (status !== 0) {
    throw new Error("Disposable superadmin bootstrap command failed: " + output.slice(-1000));
  }
}

async function checkActualPage(page, pathname) {
  await verifyBackofficeContent(page, pathname);
  const final = new URL(page.url());
  if (final.origin !== origin || final.pathname !== pathname) {
    throw new Error("Backoffice page redirected instead of rendering " + pathname);
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const measurements = [];
  const coverage = [];
  const technicalErrors = [];
  const budgetErrors = [];
  let chrome;
  let browser;
  let cachePage;
  let cacheSession;
  let profile;
  let currentRole = "anonymous";
  let phaseError = null;
  try {
    assertDisposableRuntime();
    const port = await availablePort();
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-backoffice-lighthouse-"));
    chrome = spawn(chromium.executablePath(), [
      "--headless=new", "--no-sandbox", "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", "--disable-extensions", "--disable-gpu",
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=*",
      "--remote-debugging-port=" + port,
      "--user-data-dir=" + profile, "about:blank",
    ], { stdio: "ignore" });
    browser = await chromium.connectOverCDP(await waitForDebugger(port, chrome));
    const context = browser.contexts()[0];
    if (!context) throw new Error("No default Chrome session context");
    cachePage = await context.newPage();
    cacheSession = await context.newCDPSession(cachePage);
    await cacheSession.send("Network.enable");
    const { default: lighthouse } = await import("lighthouse");

    const audit = async (route) => {
      const requested = auditUrl(route, origin);
      for (let run = 1; run <= numberOfRuns; run += 1) {
        let report;
        let valid = false;
        let sameNavigationReady = false;
        let observer;
        try {
          await cacheSession.send("Network.clearBrowserCache");
          observer = observeNavigation(context, requested, (page) =>
            checkActualPage(page, route.path));
          let observation;
          let observationError;
          try {
            const measured = await lighthouse(requested, {
              port, logLevel: "error", disableStorageReset: true,
              throttlingMethod: "simulate", maxWaitForFcp: 30000,
              maxWaitForLoad: 45000,
            });
            report = measured?.lhr;
          } finally {
            try {
              observation = await observer.finish();
            } catch (error) {
              observationError = error;
            }
          }
          if (!report) throw new Error("Lighthouse did not return an LHR");
          const file = route.mode + "-" + route.path.replaceAll("/", "-").replace(/^-+/, "") +
            "-" + run + ".json";
          fs.writeFileSync(path.join(outputDir, file), JSON.stringify(report));
          verifyRouteIdentity(route, report, origin);
          if (observationError || !observation?.ready) {
            throw new Error(observationError?.message || "Same-navigation DOM was not ready");
          }
          sameNavigationReady = true;
          const requests = networkRequests(report);
          const scriptError = scriptTransfer(report, requests);
          if (scriptError) throw new Error(scriptError);
          const errors = assessBackofficeReport(report, route.path, origin, {
            hasSession: currentRole !== "anonymous",
          });
          if (errors.length) throw new Error(errors.join("; "));
          valid = true;
        } catch (error) {
          // Do not include query strings, credentials, session IDs, or tokens in logs.
          technicalErrors.push(route.mode + " " + route.path + " run " + run +
            ": " + String(error.message).replace(/https?:\/\/[^\s]+/g, "[redacted URL]"));
        }
        measurements.push({ path: route.mode + ":" + route.path, report, valid });
        coverage.push({
          id: route.mode + ":" + route.path + ":" + run,
          pathname: route.path, scenario: route.mode, valid, sameNavigationReady,
        });
      }
      console.log("Backoffice Lighthouse collected " +
        coverage.filter((item) => item.pathname === route.path &&
          item.scenario === route.mode && item.valid).length +
        "/" + numberOfRuns + " valid runs for " + route.mode + " " + route.path);
    };

    await audit(backofficeRoutes[0]); // anonymous login first
    const backupCodes = await enrollAdministrator(context.request);
    await signInWithMfa(context.request, "admin", backupCodes[0]);
    currentRole = "admin";
    for (const route of backofficeRoutes.filter((item) => item.mode === "backoffice-admin")) {
      await audit(route);
    }
    await promoteDisposableAdmin();
    const oldSession = await context.request.get(origin + "/api/v1/users/me");
    if (oldSession.ok()) throw new Error("Promotion did not revoke the administrator session");
    await signInWithMfa(context.request, "superadmin", backupCodes[1]);
    currentRole = "superadmin";
    for (const route of backofficeRoutes.filter((item) =>
      item.mode === "backoffice-superadmin")) {
      await audit(route);
    }
  } catch (error) {
    phaseError = error;
    technicalErrors.push("Backoffice Lighthouse setup/state transition: " +
      String(error.message).replace(/https?:\/\/[^\s]+/g, "[redacted URL]"));
  } finally {
    const coverageErrors = assertBackofficeAuditCoverage(coverage, backofficeRoutes, numberOfRuns);
    technicalErrors.push(...coverageErrors);
    for (const mode of ["backoffice-public", "backoffice-admin", "backoffice-superadmin"]) {
      const paths = backofficeRoutes.filter((route) => route.mode === mode)
        .map((route) => route.path);
      const reports = measurements.filter((item) => item.valid && item.report &&
        item.path.startsWith(mode + ":")).map((item) => item.report);
      // Reuse canonical pessimistic CI budgets. The mode argument changes only
      // route identity, not the thresholds or worst-of-three aggregation.
      budgetErrors.push(...assertWorstRunBudgets(
        reports, paths, origin, config.ci.assert.assertions, numberOfRuns, mode,
      ));
    }
    const summary = writePerformanceReport(outputDir, {
      label: "Backoffice (real admin and superadmin)",
      paths: backofficeRoutes.map((route) => route.mode + ":" + route.path),
      results: measurements,
      expectedRuns: numberOfRuns,
      technicalErrors, budgetErrors,
    });
    fs.writeFileSync(path.join(outputDir, "coverage.json"), JSON.stringify({
      branch: process.env.GITHUB_SHA || null,
      expected: backofficeRoutes.map((route) => ({
        mode: route.mode, path: route.path,
      })),
      measurements: coverage,
      complete: !phaseError && !coverageErrors.length,
    }, null, 2));
    console.log("Backoffice Lighthouse: " + summary.measuredPages +
      "/" + summary.expectedPages + " complete pages");
    if (technicalErrors.length) console.error(technicalErrors.join("\n"));
    if (budgetErrors.length) console.error("Worst-run budget breaches:\n" + budgetErrors.join("\n"));
    if (technicalErrors.length || budgetErrors.length) process.exitCode = 1;
    if (cacheSession) await cacheSession.detach().catch(() => undefined);
    if (cachePage) await cachePage.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    chrome?.kill("SIGTERM");
    if (profile) fs.rmSync(profile, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backoffice Lighthouse failed: " + error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertDisposableRuntime };
