const path = require("node:path");
const { defineConfig } = require("@playwright/test");
const DEFAULT_BASE_URL = "http://127.0.0.1:4173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL;
const frontendDir = path.resolve(__dirname, "../../../apps/frontend");

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  use: {
    baseURL,
    headless: true,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command:
      "corepack pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist/client",
    cwd: frontendDir,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
});
