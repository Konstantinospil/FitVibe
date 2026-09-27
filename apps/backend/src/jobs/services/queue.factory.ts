import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { queueService as inMemoryQueue } from "./queue.service.js";
import { getBullMQService, shutdownBullMQ } from "./bullmq.queue.service.js";
import type { QueueJob } from "./queue.service.js";

export interface IQueueService {
  enqueue(job: QueueJob): void | Promise<void>;
  getQueueLength?(): number | Promise<number>;
  isProcessing?(): boolean;
}

export type QueueAdapter = "bullmq" | "memory";

export function getQueueService(): IQueueService {
  if (env.redis.enabled) {
    logger.info("[queue] Using BullMQ (Redis-backed) queue service");
    const bullMQ = getBullMQService();
    if (!bullMQ) {
      throw new Error("[queue] Redis is enabled but BullMQ could not be initialized");
    }
    return bullMQ;
  }

  if (env.isProduction) {
    throw new Error(
      "[queue] Production requires the durable Redis/BullMQ queue; REDIS_ENABLED must be true",
    );
  }

  logger.info("[queue] Using in-memory queue service for non-production runtime");
  return inMemoryQueue;
}

export function getQueueAdapter(): QueueAdapter {
  return env.redis?.enabled === true ? "bullmq" : "memory";
}

export async function checkQueueHealth(): Promise<boolean> {
  if (env.redis?.enabled !== true) {
    return !env.isProduction;
  }
  const bullMQ = getBullMQService();
  return bullMQ ? bullMQ.checkHealth() : false;
}

export async function shutdownQueue(): Promise<void> {
  if (env.redis?.enabled === true) {
    await shutdownBullMQ();
  } else {
    inMemoryQueue.shutdown();
  }

  logger.info("[queue] Queue service shutdown complete");
}

export const queueService: IQueueService = {
  enqueue(job: QueueJob): void | Promise<void> {
    return getQueueService().enqueue(job);
  },
  getQueueLength(): number | Promise<number> {
    const service = getQueueService();
    return service.getQueueLength ? service.getQueueLength() : 0;
  },
  isProcessing(): boolean {
    const service = getQueueService();
    return service.isProcessing ? service.isProcessing() : false;
  },
};
