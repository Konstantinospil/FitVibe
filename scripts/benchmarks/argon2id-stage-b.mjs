/**
 * #557 Stage B: benchmark the actual production password hashing module.
 * Requires the repository's Node 24 runtime and dependencies (pnpm install).
 * Never benchmark with real users' passwords or record secrets in output.
 *
 * Run on each target architecture:
 *   node scripts/benchmarks/argon2id-stage-b.mjs
 */
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { arch, platform, totalmem } from "node:os";
import { hashPassword, verifyPasswordHash } from "../../apps/backend/src/modules/auth/password-hashing.service.ts";

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor < 24 || (nodeMajor === 24 && nodeMinor < 7)) {
  throw new Error("The production Argon2id implementation requires Node 24.7+");
}

const randomPassphrase = () => randomBytes(36).toString("base64url");
const serialMs = [];
let measuredPeakRss = process.memoryUsage().rss;
const noteRss = () => {
  measuredPeakRss = Math.max(measuredPeakRss, process.memoryUsage().rss);
};

const startTotal = performance.now();
for (let i = 0; i < 5; i += 1) {
  const candidate = randomPassphrase();
  const start = performance.now();
  const hash = await hashPassword(candidate);
  const elapsedMs = performance.now() - start;
  if (!(await verifyPasswordHash(candidate, hash))) {
    throw new Error("Argon2id round-trip verification failed");
  }
  if (await verifyPasswordHash(candidate + "x", hash)) {
    throw new Error("Argon2id accepted the wrong password");
  }
  serialMs.push(elapsedMs);
  noteRss();
}

const parallelStart = performance.now();
const parallelPasswords = [randomPassphrase(), randomPassphrase()];
const hashes = await Promise.all(parallelPasswords.map(hashPassword));
const parallelHashMs = performance.now() - parallelStart;
for (let i = 0; i < parallelPasswords.length; i += 1) {
  if (!(await verifyPasswordHash(parallelPasswords[i], hashes[i]))) {
    throw new Error("Parallel Argon2id verification failed");
  }
}
noteRss();

const sorted = [...serialMs].sort((a, b) => a - b);
const round = (value) => Math.round(value * 10) / 10;
console.log(JSON.stringify({
  benchmark: "FitVibe #557 Stage B Argon2id",
  platform: platform(),
  architecture: arch(),
  node: process.version,
  physicalMemoryGiB: round(totalmem() / (1024 ** 3)),
  parameters: { memoryMiB: 64, passes: 3, parallelism: 1 },
  serialHashMs: serialMs.map(round),
  serialMedianMs: round(sorted[Math.floor(sorted.length / 2)]),
  parallelTwoHashMs: round(parallelHashMs),
  observedRssPeakMiB: round(measuredPeakRss / (1024 ** 2)),
  totalWallMs: round(performance.now() - startTotal),
  note: "Observed RSS is an after-operation sample, not a true peak monitor; use OS metrics for load tests.",
}, null, 2));
