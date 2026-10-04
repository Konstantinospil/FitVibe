import { logger } from "../../config/logger.js";
import type { QueueJob } from "./queue.service.js";
import { queueService } from "./queue.factory.js";

export class PointsJobsService {
  schedule(job: QueueJob): void {
    try {
      const enqueueResult = queueService.enqueue(job);
      if (enqueueResult && typeof enqueueResult.then === "function") {
        void enqueueResult.catch((error: unknown) => {
          logger.error(
            { job, error: error instanceof Error ? error.message : String(error) },
            "[jobs] Failed to enqueue points job",
          );
        });
      }
      logger.debug({ job }, "[jobs] Enqueued points job");
    } catch (error) {
      logger.error(
        { job, error: error instanceof Error ? error.message : String(error) },
        "[jobs] Failed to enqueue points job",
      );
    }
  }

  scheduleStreakEvaluation(userId: string, sessionId: string, completedAt: string): void {
    this.schedule({
      name: "points.streaks.evaluate",
      payload: {
        userId,
        sessionId,
        completedAt,
      },
    });
  }

  scheduleSeasonalEventSweep(userId: string, sessionId: string, completedAt: string): void {
    this.schedule({
      name: "points.seasonal_events.evaluate",
      payload: {
        userId,
        sessionId,
        completedAt,
      },
    });
  }

  scheduleProjectionReconciliation(
    userId: string,
    sessionId?: string,
    forceFullRebuild = false,
  ): void {
    this.schedule({
      name: "points.projection.reconcile",
      payload: {
        userId,
        sessionId: sessionId ?? null,
        forceFullRebuild,
      },
    });
  }
}

export const pointsJobsService = new PointsJobsService();
