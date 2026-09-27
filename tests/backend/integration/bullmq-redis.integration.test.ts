import Redis from "ioredis";
import { jest } from "@jest/globals";

const mockExecuteSharedJob = jest.fn(async (_name: string, payload: Record<string, unknown>) => {
  if (payload.fail === true) {
    throw new Error("forced integration failure");
  }
  return { ok: true };
});

jest.mock("../../../apps/backend/src/jobs/services/job.handlers.js", () => ({
  SHARED_JOB_TYPES: ["retention.sweep"] as const,
  executeSharedJob: mockExecuteSharedJob,
}));

import { BullMQQueueService } from "../../../apps/backend/src/jobs/services/bullmq.queue.service.js";

const describeRedis = process.env.REDIS_INTEGRATION === "1" ? describe : describe.skip;

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 10000,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for BullMQ state");
}

describeRedis("BullMQ Redis integration", () => {
  const host = process.env.REDIS_HOST ?? "127.0.0.1";
  const port = Number(process.env.REDIS_PORT ?? "6379");
  const db = 15;
  let redis: Redis;
  let service: BullMQQueueService;

  beforeEach(async () => {
    mockExecuteSharedJob.mockClear();
    redis = new Redis({ host, port, db, maxRetriesPerRequest: null });
    await redis.flushdb();
    service = new BullMQQueueService({ host, port, db, maxRetriesPerRequest: null });
    expect(await service.checkHealth()).toBe(true);
  });

  afterEach(async () => {
    await service.shutdown();
    await redis.flushdb();
    await redis.quit();
  });

  it("persists and processes an enqueued job through Redis", async () => {
    await service.enqueue({
      name: "retention.sweep",
      payload: { integration: true },
    });

    await waitFor(async () => {
      const stats = await service.getQueueStats("retention.sweep");
      return stats.completed >= 1;
    });

    expect(mockExecuteSharedJob).toHaveBeenCalledWith(
      "retention.sweep",
      expect.objectContaining({ integration: true }),
    );
  });

  it("retries a failing job and retains the terminal failure", async () => {
    await service.enqueue(
      {
        name: "retention.sweep",
        payload: { fail: true },
      },
      {
        attempts: 2,
        backoff: { type: "fixed", delay: 50 },
        removeOnFail: false,
      },
    );

    await waitFor(async () => {
      const stats = await service.getQueueStats("retention.sweep");
      return stats.failed >= 1;
    });

    const failed = await service.getFailedJobs("retention.sweep");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.attemptsMade).toBe(2);
    expect(mockExecuteSharedJob).toHaveBeenCalledTimes(2);
  });
});
