#!/usr/bin/env node
"use strict";
// Authenticated Lighthouse audits run inside the already-provisioned real E2E
// stack. They do not start, mock or reset the backend or its database.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { athleteRoutes, auditUrl } = require("./lighthouse-routes.cjs");
const { verifyRouteIdentity } = require("./lighthouse-report-contract.cjs");
const { assertWorstRunBudgets } = require("./lighthouse-score-contract.cjs");
const {
  createFirstLoginAccount,
  ensureSeededOnboardingComplete,
  ensureEssentialCookieConsent,
  waitForApp,
} = require("../frontend/e2e/server-helpers.cjs");

const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4180";
const auditDir = path.resolve(__dirname, "lhci-output/authenticated");
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "lighthouserc.ci.json"), "utf8"));
const runCount = config.ci.collect.numberOfRuns;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function connectDebugger(port, chrome) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (chrome.exitCode !== null) throw new Error("Chrome exited before its debugger was ready");
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (response.ok) {
        const data = await response.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome is not listening yet.
    }
    await delay(500);
  }
  throw new Error("Chrome CDP endpoint did not become ready");
}

function installSessionBootstrap(browserEndpoint) {
  // Lighthouse creates a new tab for a navigation audit. FitVibe legitimately
  // requires both its HttpOnly login cookie AND a tab-scoped sessionStorage
  // hint. Setting the hint on the Playwright setup tab would not transfer.
  // Pause each newly created target before navigation, install the hint, then
  // resume it. No fake API response, token or server-side authorization bypass.
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(browserEndpoint);
    const pending = new Map();
    const errors = [];
    let sequence = 0;
    let closed = false;

    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const id = ++sequence;
      pending.set(id, { ok, fail });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

    socket.addEventListener("error", () => {
      if (!closed) errors.push("Chrome CDP socket failed");
    });
    socket.addEventListener("close", () => {
      closed = true;
      for (const entry of pending.values()) entry.fail(new Error("CDP socket closed"));
      pending.clear();
    });
    socket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data.toString());
      if (message.id && pending.has(message.id)) {
        const entry = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) entry.fail(new Error(message.error.message));
        else entry.ok(message.result);
        return;
      }
      if (message.method !== "Target.attachedToTarget") return;
      const { sessionId, targetInfo } = message.params;
      try {
        if (targetInfo.type === "page") {
          await send("Page.enable", {}, sessionId);
          await send("Page.addScriptToEvaluateOnNewDocument", {
            source: String.raw`try {
              if (location.origin === "http://127.0.0.1:4180") {
                sessionStorage.setItem("fitvibe:auth", "1");
              }
            } catch { /* Storage is unavailable in some internal frames. */ }`,
          }, sessionId);
        }
      } catch (error) {
        errors.push("Target bootstrap failed: " + error.message);
      } finally {
        try {
          await send("Runtime.runIfWaitingForDebugger", {}, sessionId);
        } catch (error) {
          errors.push("Unable to resume browser target: " + error.message);
        }
      }
    });
    socket.addEventListener("open", async () => {
      try {
        await send("Target.setAutoAttach", {
          autoAttach: true,
          waitForDebuggerOnStart: true,
          flatten: true,
        });
        resolve({
          assertHealthy: () => {
            if (errors.length) throw new Error(errors.join("\n"));
          },
          close: () => {
            closed = true;
            socket.close();
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function prepareAthlete(browser) {
  const context = browser.contexts()[0];
  if (!context) throw new Error("Browser does not expose the default session context");
  const page = await context.newPage();
  try {
    const athlete = await createFirstLoginAccount(page, {
      testId: "lighthouse-authenticated-pages",
      retry: 0,
      repeatEachIndex: 0,
    });
    await ensureSeededOnboardingComplete(page);
    await ensureEssentialCookieConsent(page);
    const me = await context.request.get(origin + "/api/v1/users/me");
    if (!me.ok() || (await me.json()).primaryEmail !== athlete.email) {
      throw new Error("Lighthouse athlete's server-side session was not verified");
    }

    await page.addInitScript(() => sessionStorage.setItem("fitvibe:auth", "1"));
    for (const pathName of athleteRoutes) {
      const route = { mode: "athlete", path: pathName };
      await page.goto(auditUrl(route, origin), { waitUntil: "domcontentloaded" });
      await waitForApp(page);
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 25000 });
      const final = new URL(page.url());
      if (final.origin !== origin || final.pathname !== pathName) {
        throw new Error("E2E preflight did not render " + pathName + " (got " + page.url() + ")");
      }
      if (pathName === "/" || ["/calendar", "/library", "/dashboard", "/settings"].includes(pathName)) {
        const surface = pathName === "/" ? "home" : pathName.slice(1);
        await page.locator('[data-app-surface="' + surface + '"]').waitFor({
          state: "visible", timeout: 25000,
        });
      }
    }
    // Verify the session after real navigation, not only after registration.
    const verified = await context.request.get(origin + "/api/v1/users/me");
    if (!verified.ok() || (await verified.json()).primaryEmail !== athlete.email) {
      throw new Error("Authenticated Lighthouse preflight lost its real backend session");
    }
  } finally {
    await page.close();
  }
}

async function main() {
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error("PLAYWRIGHT_BASE_URL is mandatory to select the real E2E ingress");
  }
  if (new URL(origin).hostname !== "127.0.0.1") {
    throw new Error("Authenticated Lighthouse may only run against isolated loopback ingress");
  }
  if (!Number.isInteger(runCount) || runCount < 3) throw new Error("Expected at least three Lighthouse runs");
  const port = await findAvailablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-lighthouse-"));
  const chrome = spawn(chromium.executablePath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-gpu",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=" + port,
    "--user-data-dir=" + profile,
    "about:blank",
  ], { stdio: "ignore" });
  let browser;
  let bootstrap;
  try {
    const endpoint = await connectDebugger(port, chrome);
    browser = await chromium.connectOverCDP(endpoint);
    await prepareAthlete(browser);
    bootstrap = await installSessionBootstrap(endpoint);
    const { default: lighthouse } = await import("lighthouse");
    fs.mkdirSync(auditDir, { recursive: true });
    const auditResults = [];
    for (const pathName of athleteRoutes) {
      const route = { mode: "athlete", path: pathName };
      const reports = [];
      for (let run = 1; run <= runCount; run += 1) {
        const url = auditUrl(route, origin);
        const result = await lighthouse(url, {
          port,
          logLevel: "error",
          disableStorageReset: true,
          throttlingMethod: "simulate",
          maxWaitForFcp: 30000,
          maxWaitForLoad: 45000,
        });
        if (!result?.lhr) throw new Error("Lighthouse did not return a report for " + url);
        verifyRouteIdentity(route, result.lhr, origin);
        bootstrap.assertHealthy();
        const filename = "lhr-" + (pathName === "/" ? "home" : pathName.slice(1).replaceAll("/", "-")) +
          "-" + run + ".json";
        fs.writeFileSync(path.join(auditDir, filename), JSON.stringify(result.lhr));
        reports.push(result.lhr);
      }
      auditResults.push(...reports);
      console.log("Authenticated Lighthouse completed " + pathName + " (" + runCount + " runs)");
    }
    const failures = assertWorstRunBudgets(auditResults, athleteRoutes, origin, config.ci.assert.assertions);
    fs.writeFileSync(path.join(auditDir, "summary.json"), JSON.stringify({
      auditedPaths: athleteRoutes,
      runsPerRoute: runCount,
      failures,
    }, null, 2));
    if (failures.length) throw new Error("Authenticated Lighthouse budgets failed:\n" + failures.join("\n"));
    console.log("Authenticated Lighthouse passed: " + athleteRoutes.length + " routes");
  } finally {
    bootstrap?.close();
    await browser?.close().catch(() => undefined);
    chrome.kill("SIGTERM");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
