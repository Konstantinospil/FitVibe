import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "../../../..");
const frontendDir = path.join(repoRoot, "apps/frontend");

const light = { name: "light", colorScheme: "light" as const };
const dark = { name: "dark", colorScheme: "dark" as const };

const viewports = [
  { name: "xs", width: 360, height: 900 },
  { name: "sm", width: 640, height: 900 },
  { name: "md", width: 1024, height: 900 },
  { name: "lg", width: 1280, height: 900 },
];

const previewCommand =
  "corepack pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort --outDir dist/client";

export default defineConfig({
  testDir: "../",
  testMatch: ["pages/**/*.spec.ts", "components/**/*.spec.ts"],
  testIgnore: ["**/archive/**"],
  outputDir: "../__screenshots__",
  // OS suffix (win32 / linux) so Windows local runs and Ubuntu Actions do not
  // compare against each other's font-rasterized pixels.
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}",
  reporter: [
    ["html", { outputFolder: "../../playwright-report/visual", open: "never" }],
    ["list"],
    ["junit", { outputFile: "../../test-results/visual-junit.xml" }],
  ],
  use: {
    baseURL: process.env.APP_URL || "http://127.0.0.1:4173",
    timezoneId: "UTC",
    locale: "en-US",
    geolocation: { latitude: 52.52, longitude: 13.405 },
    colorScheme: "light",
    viewport: { width: 1024, height: 900 },
    reducedMotion: "reduce",
    video: "off",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    snapshotSuffix: process.platform,
  },
  projects: [
    ...[light, dark].flatMap((theme) =>
      viewports.map((vp) => ({
        name: `ui:${theme.name}:${vp.name}`,
        use: {
          browserName: "chromium" as const,
          colorScheme: theme.colorScheme,
          viewport: { width: vp.width, height: vp.height },
          reducedMotion: "reduce" as const,
        },
      })),
    ),
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      threshold: 0.2,
      animations: "disabled",
      timeout: 15_000,
    },
  },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  webServer:
    process.env.DISABLE_WEBSERVER === "true" || (process.env.CI && process.env.GITHUB_ACTIONS)
      ? undefined
      : {
          command: previewCommand,
          cwd: frontendDir,
          url: "http://127.0.0.1:4173",
          timeout: 120_000,
          reuseExistingServer: true,
        },
});
