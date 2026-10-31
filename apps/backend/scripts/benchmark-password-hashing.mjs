#!/usr/bin/env node
/**
 * Stage B / #557 reproducible runtime benchmark.
 * Run with Node >=24.7 on the Pi arm64 and on the deployment amd64 host.
 * Uses synthetic input only. Does not read credentials or print secrets.
 */
import { argon2, randomBytes } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";

const iterations = Number(process.env.ARGON2_BENCH_RUNS ?? 5);
const concurrency = Number(process.env.ARGON2_BENCH_CONCURRENCY ?? 2);
if (!Number.isInteger(iterations) || iterations < 3 || iterations > 30 ||
    !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new Error("ARGON2_BENCH_RUNS must be 3–30 and CONCURRENCY 1–8");
}
if (typeof argon2 !== "function") {
  throw new Error("Node >=24.7 with native crypto.argon2 support is required");
}

const password = "Synthetic-FitVibe-Benchmark-Passphrase-2026";
function derive() {
  return new Promise((resolve, reject) => {
    argon2("argon2id", {
      message: password,
      nonce: randomBytes(16),
      parallelism: 1,
      memory: 65536,
      passes: 3,
      tagLength: 32,
    }, (error, tag) => error ? reject(error) : resolve(tag));
  });
}

async function measure() {
  const start = performance.now();
  await derive();
  return Math.round(performance.now() - start);
}
function percentile(samples, percentileValue) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length * percentileValue) / 100) - 1];
}

await derive(); // JIT/provider warm-up, excluded from sample
const sequentialMs = [];
for (let i = 0; i < iterations; i++) sequentialMs.push(await measure());

let peakRss = process.memoryUsage().rss;
const sampleRss = setInterval(() => {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}, 10);
const concurrentStart = performance.now();
const concurrentMs = await Promise.all(Array.from({ length: concurrency }, () => measure()));
clearInterval(sampleRss);
peakRss = Math.max(peakRss, process.memoryUsage().rss);

console.log(JSON.stringify({
  benchmark: "FitVibe Argon2id Stage B #557",
  timestamp: new Date().toISOString(),
  node: process.version,
  architecture: process.arch,
  platform: process.platform,
  cpu: os.cpus()[0]?.model,
  memoryGiB: Number((os.totalmem() / 2 ** 30).toFixed(2)),
  parameters: { memoryKiB: 65536, passes: 3, parallelism: 1, tagLength: 32 },
  runs: iterations,
  sequentialMs,
  sequentialP50Ms: percentile(sequentialMs, 50),
  sequentialP95Ms: percentile(sequentialMs, 95),
  concurrency,
  concurrentMs,
  concurrentWallMs: Math.round(performance.now() - concurrentStart),
  observedPeakRssMiB: Math.round(peakRss / 2 ** 20),
  caveat: "RSS sampling may miss short memory peaks; verify capacity with host/container memory metrics.",
}, null, 2));
