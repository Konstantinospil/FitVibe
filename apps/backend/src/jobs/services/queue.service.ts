import { logger } from "../../config/logger.js";
import { executeSharedJob, SHARED_JOB_TYPES } from "./job.handlers.js";

export interface QueueJob {
  name: string;
  payload: Record<string, unknown>;
  attemptCount?: number;
  lastError?: string;
  enqueuedAt?: Date;
}

export interface DeadLetterJob extends QueueJob {
  failedAt: Date;
  finalError: string;
  totalAttempts: number;
}

type JobHandler = (job: QueueJob) => Promise<void>;

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Simple in-memory queue implementation for background jobs.
 * This is a minimal implementation that can be replaced with BullMQ/Temporal in production.
 * Jobs are processed asynchronously in a non-blocking manner.
 */
export class QueueService {
  private queue: QueueJob[] = [];
  private deadLetterQueue: DeadLetterJob[] = [];
  private handlers: Map<string, JobHandler> = new Map();
  private processing = false;
  private activeTimers: Set<NodeJS.Timeout> = new Set();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register default job handlers for known job types
   */
  private registerDefaultHandlers(): void {
    for (const jobName of SHARED_JOB_TYPES) {
      this.registerHandler(jobName, async (job) => {
        logger.debug({ job }, "[queue] Processing shared job");
        await executeSharedJob(jobName, job.payload);
      });
    }
  }

  /**
   * Register a custom job handler
   */
  registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }

  /**
   * Enqueue a job for processing
   */
  enqueue(job: QueueJob): void {
    const enrichedJob: QueueJob = {
      ...job,
      attemptCount: job.attemptCount ?? 0,
      enqueuedAt: job.enqueuedAt ?? new Date(),
    };

    this.queue.push(enrichedJob);
    logger.debug({ job: enrichedJob, queueLength: this.queue.length }, "[queue] Job enqueued");

    // Trigger processing asynchronously (non-blocking)
    setImmediate(() => {
      this.process().catch((error) => {
        logger.error({ error }, "[queue] Error during job processing");
      });
    });
  }

  /**
   * Calculate retry delay using exponential backoff
   * @param attemptCount - Current attempt count (0-indexed)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff: 2s, 4s, 8s
    return BASE_RETRY_DELAY_MS * Math.pow(2, attemptCount);
  }

  /**
   * Schedule a job retry with exponential backoff
   * @param job - The job to retry
   */
  private scheduleRetry(job: QueueJob): void {
    const attemptCount = (job.attemptCount ?? 0) + 1;
    const delay = this.calculateRetryDelay(attemptCount);

    logger.info(
      { job: job.name, attemptCount, delay, maxAttempts: MAX_RETRY_ATTEMPTS },
      "[queue] Scheduling job retry",
    );

    const timerId = setTimeout(() => {
      this.activeTimers.delete(timerId);
      this.enqueue({
        ...job,
        attemptCount,
      });
    }, delay);
    this.activeTimers.add(timerId);
  }

  /**
   * Move a job to the dead-letter queue
   * @param job - The permanently failed job
   * @param error - The final error
   */
  private moveToDeadLetterQueue(job: QueueJob, error: Error): void {
    const deadLetterJob: DeadLetterJob = {
      ...job,
      failedAt: new Date(),
      finalError: error.message,
      totalAttempts: (job.attemptCount ?? 0) + 1,
    };

    this.deadLetterQueue.push(deadLetterJob);

    logger.error(
      {
        job: deadLetterJob.name,
        totalAttempts: deadLetterJob.totalAttempts,
        error: deadLetterJob.finalError,
        payload: deadLetterJob.payload,
      },
      "[queue] Job moved to dead-letter queue after max retries",
    );

    // In production, this would persist to database or external queue
    // For now, keep in memory (will be lost on restart)
  }

  /**
   * Process all pending jobs in the queue
   */
  async process(): Promise<void> {
    // Prevent concurrent processing
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) {
          break;
        }

        const handler = this.handlers.get(job.name);
        if (!handler) {
          logger.warn({ job }, "[queue] No handler registered for job type");
          continue;
        }

        try {
          await handler(job);
          logger.debug(
            { job: job.name, attemptCount: job.attemptCount ?? 0 },
            "[queue] Job processed successfully",
          );
        } catch (error) {
          const err = error as Error;
          const attemptCount = (job.attemptCount ?? 0) + 1;

          logger.error(
            { error: err.message, job: job.name, attemptCount },
            "[queue] Job processing failed",
          );

          // Update job with error info
          job.lastError = err.message;

          // Retry if under max attempts, otherwise move to dead-letter queue
          if (attemptCount < MAX_RETRY_ATTEMPTS) {
            this.scheduleRetry(job);
          } else {
            this.moveToDeadLetterQueue(job, err);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get current queue length (useful for monitoring)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get dead-letter queue contents (for monitoring/debugging)
   */
  getDeadLetterQueue(): DeadLetterJob[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear the dead-letter queue
   * Use with caution - typically only for testing or after manual intervention
   */
  clearDeadLetterQueue(): void {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    logger.info({ count }, "[queue] Dead-letter queue cleared");
  }

  /**
   * Manually retry a job from the dead-letter queue
   * @param index - Index of the job in dead-letter queue
   */
  retryDeadLetterJob(index: number): boolean {
    if (index < 0 || index >= this.deadLetterQueue.length) {
      logger.warn({ index }, "[queue] Invalid dead-letter queue index");
      return false;
    }

    const deadJob = this.deadLetterQueue.splice(index, 1)[0];
    const retryJob: QueueJob = {
      name: deadJob.name,
      payload: deadJob.payload,
      attemptCount: 0, // Reset attempt count for manual retry
      enqueuedAt: new Date(),
    };

    this.enqueue(retryJob);
    logger.info({ job: retryJob.name }, "[queue] Dead-letter job manually retried");

    return true;
  }

  /**
   * Shutdown the queue service and clear all pending timers
   * This should be called during test teardown to prevent open handles
   */
  shutdown(): void {
    // Clear all active timers
    for (const timerId of this.activeTimers) {
      clearTimeout(timerId);
    }
    this.activeTimers.clear();

    // Clear queues
    this.queue = [];
    this.deadLetterQueue = [];

    logger.info("[queue] Queue service shut down");
  }
}

export const queueService = new QueueService();
