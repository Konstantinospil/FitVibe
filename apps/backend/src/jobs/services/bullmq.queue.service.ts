import { Queue, Worker, type Job, type JobsOptions, type ConnectionOptions } from "bullmq";
import type { Redis } from "ioredis";
import { logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { executeSharedJob, SHARED_JOB_TYPES, type SharedJobType } from "./job.handlers.js";

/**
 * Job payload interface for type safety
 */
export interface QueueJob {
  name: string;
  payload: Record<string, unknown>;
}

/**
 * BullMQ-based queue service for production use
 * Provides persistent, Redis-backed job queue with retry, DLQ, and horizontal scaling
 */
export class BullMQQueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private connection: ConnectionOptions;

  constructor(redisConnection?: ConnectionOptions | Redis) {
    // Use provided connection or default to localhost
    if (redisConnection && "host" in redisConnection) {
      this.connection = redisConnection as ConnectionOptions;
    } else {
      this.connection = {
        host: env.redis.host,
        port: env.redis.port,
        password: env.redis.password,
        db: env.redis.db,
        maxRetriesPerRequest: null, // Required for BullMQ
      };
    }

    this.initializeQueues();
    this.startWorkers();
  }

  /**
   * Initialize BullMQ queues for each job type
   */
  private initializeQueues(): void {
    const jobTypes = SHARED_JOB_TYPES;

    for (const jobType of jobTypes) {
      const queue = new Queue(jobType, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3, // Max retry attempts
          backoff: {
            type: "exponential",
            delay: 2000, // 2 seconds base delay
          },
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 604800, // Keep failed jobs for 7 days
            count: 5000, // Keep last 5000 failed jobs
          },
        },
      });

      this.queues.set(jobType, queue);
      logger.info({ jobType }, "[bullmq] Queue initialized");
    }
  }

  /**
   * Start workers to process jobs from each queue
   */
  private startWorkers(): void {
    for (const jobType of SHARED_JOB_TYPES) {
      this.startWorker(jobType, async (job) => {
        logger.debug({ jobId: job.id, jobType, data: job.data }, "[bullmq] Processing shared job");
        const payload =
          typeof job.data === "object" && job.data !== null
            ? (job.data as Record<string, unknown>)
            : {};
        return executeSharedJob(jobType as SharedJobType, payload);
      });
    }
  }

  /**
   * Start a worker for a specific queue
   */
  private startWorker(queueName: string, processor: (job: Job) => Promise<unknown>): void {
    const worker = new Worker(queueName, processor, {
      connection: this.connection,
      concurrency: env.bullmq.concurrency,
      limiter: {
        max: env.bullmq.rateLimitMax,
        duration: env.bullmq.rateLimitDuration,
      },
    });

    // Worker event handlers
    worker.on("completed", (job) => {
      logger.debug({ jobId: job.id, queueName }, "[bullmq] Job completed successfully");
    });

    worker.on("failed", (job, err) => {
      if (job) {
        logger.error(
          { jobId: job.id, queueName, error: err.message, attemptsMade: job.attemptsMade },
          "[bullmq] Job failed",
        );
      } else {
        logger.error({ queueName, error: err.message }, "[bullmq] Job failed (no job object)");
      }
    });

    worker.on("error", (err) => {
      logger.error({ queueName, error: err.message }, "[bullmq] Worker error");
    });

    this.workers.set(queueName, worker);
    logger.info({ queueName }, "[bullmq] Worker started");
  }

  /**
   * Enqueue a job for processing
   */
  async enqueue(job: QueueJob, options?: JobsOptions): Promise<void> {
    const queue = this.queues.get(job.name);
    if (!queue) {
      logger.warn({ jobName: job.name }, "[bullmq] No queue found for job type");
      throw new Error(`No queue registered for job type: ${job.name}`);
    }

    try {
      const bullJob = await queue.add(job.name, job.payload, options);
      logger.debug(
        { jobId: bullJob.id, jobName: job.name, queueLength: await queue.count() },
        "[bullmq] Job enqueued",
      );
    } catch (error) {
      logger.error({ error, jobName: job.name }, "[bullmq] Failed to enqueue job");
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    const firstQueue = this.queues.values().next().value as Queue | undefined;
    if (!firstQueue) {
      return false;
    }

    try {
      await firstQueue.waitUntilReady();
      return true;
    } catch (error) {
      logger.error({ error }, "[bullmq] Redis health check failed");
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get failed jobs (dead-letter queue equivalent)
   */
  async getFailedJobs(queueName: string, start = 0, end = 99): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    return queue.getFailed(start, end);
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.retry();
    logger.info({ jobId, queueName }, "[bullmq] Job manually retried");
  }

  /**
   * Remove a job from the failed queue
   */
  async removeFailedJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await job.remove();
    logger.info({ jobId, queueName }, "[bullmq] Failed job removed");
  }

  /**
   * Clean old jobs from queues
   */
  async cleanQueue(
    queueName: string,
    grace: number = 86400000, // 24 hours in ms
    status: "completed" | "failed" = "completed",
  ): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    const jobs = await queue.clean(grace, 1000, status);
    logger.info({ queueName, count: jobs.length, status }, "[bullmq] Queue cleaned");
    return jobs;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    await queue.pause();
    logger.info({ queueName }, "[bullmq] Queue paused");
  }

  /**
   * Resume a paused queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`No queue found: ${queueName}`);
    }

    await queue.resume();
    logger.info({ queueName }, "[bullmq] Queue resumed");
  }

  /**
   * Graceful shutdown - close all queues and workers
   */
  async shutdown(): Promise<void> {
    logger.info("[bullmq] Starting graceful shutdown");

    // Close all workers first (stop processing new jobs)
    const workerPromises = Array.from(this.workers.values()).map((worker) => worker.close());
    await Promise.all(workerPromises);
    logger.info("[bullmq] All workers closed");

    // Close all queues
    const queuePromises = Array.from(this.queues.values()).map((queue) => queue.close());
    await Promise.all(queuePromises);
    logger.info("[bullmq] All queues closed");

    logger.info("[bullmq] Graceful shutdown complete");
  }
}

// Singleton instance
let bullMQService: BullMQQueueService | null = null;

/**
 * Get or create BullMQ service instance
 * Only creates if REDIS_ENABLED=true in environment
 */
export function getBullMQService(): BullMQQueueService | null {
  if (!env.redis.enabled) {
    return null;
  }

  if (!bullMQService) {
    bullMQService = new BullMQQueueService();
  }

  return bullMQService;
}

/**
 * Shutdown BullMQ service
 */
export async function shutdownBullMQ(): Promise<void> {
  if (bullMQService) {
    await bullMQService.shutdown();
    bullMQService = null;
  }
}
