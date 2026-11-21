"use strict";
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function debuggerEndpoint(port, processHandle) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error("Chrome exited before debugger ready");
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (response.ok) {
        const data = await response.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {
      // Browser is still starting.
    }
    await delay(500);
  }
  throw new Error("Chrome debugger did not become ready");
}

async function launchLighthouseChrome() {
  const port = await availablePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "fitvibe-lighthouse-"));
  const chrome = spawn(chromium.executablePath(), [
    "--headless=new", "--no-sandbox", "--disable-setuid-sandbox",
    "--disable-dev-shm-usage", "--disable-extensions", "--disable-gpu",
    "--remote-debugging-address=127.0.0.1", "--remote-allow-origins=*",
    "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
  ], { stdio: "ignore" });
  let browser;
  try {
    const endpoint = await debuggerEndpoint(port, chrome);
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Lighthouse browser has no default context");
    const cachePage = await context.newPage();
    const cacheSession = await context.newCDPSession(cachePage);
    await cacheSession.send("Network.enable");
    return {
      port, endpoint, browser, context,
      async clearCache() { await cacheSession.send("Network.clearBrowserCache"); },
      async close() {
        await cacheSession.detach().catch(() => undefined);
        await cachePage.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
        chrome.kill("SIGTERM");
        fs.rmSync(profile, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    chrome.kill("SIGTERM");
    fs.rmSync(profile, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { launchLighthouseChrome };
