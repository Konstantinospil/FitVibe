const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const baseURL = "http://127.0.0.1:4174";
const repoRoot = path.resolve(__dirname, "../../..");

module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "corepack pnpm --filter @fitvibe/backoffice exec vite preview --host 127.0.0.1 --port 4174 --strictPort",
    cwd: repoRoot,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report/backoffice", open: "never" }],
    ["junit", { outputFile: "test-results/backoffice/junit.xml" }],
  ],
});
