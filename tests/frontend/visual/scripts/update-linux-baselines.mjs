#!/usr/bin/env node
/**
 * Capture visual baselines in Linux Chromium using the Playwright Docker image
 * (same image the CI visual job uses). Does not use docker compose.
 *
 * Requires Docker Desktop. Starts host `vite preview` if port 4173 is free.
 * Extra argv is forwarded to Playwright (spec files, --project, …).
 * Compares Linux baselines by default. Pass --update to rewrite changed Linux baselines.
 */
import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYWRIGHT_IMAGE = "mcr.microsoft.com/playwright:v1.64.0-jammy";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const frontendDir = resolve(repoRoot, "apps/frontend");
const dockerRepo = repoRoot.replaceAll("\\", "/");
const innerScript = "/work/tests/frontend/visual/scripts/linux-inner.sh";
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const dockerCmd = process.platform === "win32" ? "docker.exe" : "docker";

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: repoRoot,
    shell: process.platform === "win32" && command.endsWith(".cmd"),
    env: { ...process.env, MSYS_NO_PATHCONV: "1", ...options.env },
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
};

const isPreviewUp = () =>
  new Promise((resolveUp) => {
    const socket = connect({ port: 4173, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolveUp(true);
    });
    socket.once("error", () => resolveUp(false));
  });

if (!(await isPreviewUp())) {
  console.log("Building visual frontend bundle and starting vite preview…");
  run(pnpmCmd, ["--filter", "@fitvibe/frontend", "run", "build:visual"]);
  const preview = spawn(
    pnpmCmd,
    [
      "exec",
      "vite",
      "preview",
      "--host",
      "0.0.0.0",
      "--port",
      "4173",
      "--strictPort",
      "--outDir",
      "dist/client",
    ],
    {
      cwd: frontendDir,
      shell: process.platform === "win32",
      stdio: "ignore",
      detached: true,
      env: process.env,
    },
  );
  preview.unref();
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isPreviewUp()) break;
  }
  if (!(await isPreviewUp())) {
    console.error("vite preview did not start on port 4173");
    process.exit(1);
  }
}

const cliArgs = process.argv.slice(2);
const updateRequested = cliArgs.includes("--update");
const playwrightArgs = cliArgs.filter((arg) => arg !== "--update");
const updateSnapshots = updateRequested ? "changed" : "none";

console.log(
  `${updateRequested ? "Updating" : "Comparing"} Linux visual baselines with ${PLAYWRIGHT_IMAGE}…`,
);
run(dockerCmd, [
  "run",
  "--rm",
  "--ipc=host",
  "--add-host=host.docker.internal:host-gateway",
  "-v",
  `${dockerRepo}:/work`,
  "-w",
  "/work",
  "-e",
  "APP_URL=http://host.docker.internal:4173",
  "-e",
  "DISABLE_WEBSERVER=true",
  "-e",
  "CI=true",
  "-e",
  `UPDATE_SNAPSHOTS=${updateSnapshots}`,
  PLAYWRIGHT_IMAGE,
  "bash",
  innerScript,
  ...playwrightArgs,
]);

console.log(
  updateRequested
    ? "Linux baselines written next to the specs as *-linux.png"
    : "Linux visual comparison completed without rewriting baselines",
);
