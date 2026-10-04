import { PointsJobsService } from "../../../../apps/backend/src/jobs/services/points-jobs.service.js";
import * as queueService from "../../../../apps/backend/src/jobs/services/queue.factory.js";
import { logger } from "../../../../apps/backend/src/config/logger.js";

// Mock queue service
jest.mock("../../../../apps/backend/src/jobs/services/queue.factory.js", () => ({
  queueService: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
jest.mock("../../../../apps/backend/src/config/logger.js", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockQueueService = jest.mocked(queueService.queueService);

describe("PointsJobsService", () => {
  let service: PointsJobsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PointsJobsService();
  });

  describe("schedule", () => {
    it("should enqueue a job", () => {
      const job = {
        name: "test.job",
        payload: { test: "data" },
      };

      service.schedule(job);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith(job);
      expect(logger.debug).toHaveBeenCalledWith({ job }, "[jobs] Enqueued points job");
    });
  });

  describe("schedule failure isolation", () => {
    it("swallows synchronous enqueue failures and logs them", () => {
      jest.mocked(mockQueueService.enqueue).mockImplementationOnce(() => {
        throw new Error("queue unavailable");
      });

      expect(() =>
        service.schedule({
          name: "points.projection.reconcile",
          payload: { userId: "user-123" },
        }),
      ).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "queue unavailable",
        }),
        "[jobs] Failed to enqueue points job",
      );
    });

    it("handles asynchronous enqueue rejection without exposing it to the caller", async () => {
      jest
        .mocked(mockQueueService.enqueue)
        .mockRejectedValueOnce(new Error("redis unavailable"));

      expect(() =>
        service.schedule({
          name: "points.projection.reconcile",
          payload: { userId: "user-123" },
        }),
      ).not.toThrow();

      await Promise.resolve();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "redis unavailable",
        }),
        "[jobs] Failed to enqueue points job",
      );
    });

    it("schedules projection reconciliation with explicit rebuild intent", () => {
      service.scheduleProjectionReconciliation("user-123", "session-456", true);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        name: "points.projection.reconcile",
        payload: {
          userId: "user-123",
          sessionId: "session-456",
          forceFullRebuild: true,
        },
      });
    });
  });

  describe("scheduleStreakEvaluation", () => {
    it("should schedule streak evaluation job", () => {
      const userId = "user-123";
      const sessionId = "session-456";
      const completedAt = "2024-01-01T00:00:00Z";

      service.scheduleStreakEvaluation(userId, sessionId, completedAt);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        name: "points.streaks.evaluate",
        payload: {
          userId,
          sessionId,
          completedAt,
        },
      });
    });
  });

  describe("scheduleSeasonalEventSweep", () => {
    it("should schedule seasonal event sweep job", () => {
      const userId = "user-123";
      const sessionId = "session-456";
      const completedAt = "2024-01-01T00:00:00Z";

      service.scheduleSeasonalEventSweep(userId, sessionId, completedAt);

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        name: "points.seasonal_events.evaluate",
        payload: {
          userId,
          sessionId,
          completedAt,
        },
      });
    });
  });
});
