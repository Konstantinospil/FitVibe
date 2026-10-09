const path = require("node:path");
const { defineConfig } = require("@playwright/test");
const DEFAULT_BASE_URL = "http://127.0.0.1:4173";
const DEFAULT_FRONTEND_SERVER_URL = "http://127.0.0.1:4173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL;
const frontendServerURL =
  process.env.PLAYWRIGHT_FRONTEND_SERVER_URL || DEFAULT_FRONTEND_SERVER_URL;
const frontendDir = path.resolve(__dirname, "../../../apps/frontend");
const productionSsr = process.env.PLAYWRIGHT_USE_SSR === "true";
// CI supplies the production Docker container; never start a second workspace frontend.
const externalFrontend = process.env.PLAYWRIGHT_EXTERNAL_FRONTEND === "true";

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
  // When running against the deployed production image, infrastructure owns its lifecycle.
  ...(externalFrontend
    ? {}
    : {
        webServer: {
          command: productionSsr
            ? "corepack pnpm run start:ssr"
            : "corepack pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist/client",
          cwd: frontendDir,
          url: productionSsr ? `${frontendServerURL}/health` : frontendServerURL,
          env: productionSsr ? { NODE_ENV: "production", PORT: "4173" } : {},
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
        },
      }),
  reporter: [
    ["line"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
});
