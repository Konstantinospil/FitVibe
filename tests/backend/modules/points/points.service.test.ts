import * as pointsService from "../../../../apps/backend/src/modules/points/points.service.js";
import * as pointsRepository from "../../../../apps/backend/src/modules/points/points.repository.js";
import * as vibeLevelRepository from "../../../../apps/backend/src/modules/points/vibe-level.repository.js";
import * as badgesService from "../../../../apps/backend/src/modules/points/badges.service.js";
import * as sessionsRepository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  PointsSummary,
  PointsHistoryQuery,
  PointsHistoryResult,
  AwardPointsResult,
} from "../../../../apps/backend/src/modules/points/points.types.js";
import type { SessionWithExercises } from "../../../../apps/backend/src/modules/sessions/sessions.types.js";
import type {
  DomainVibeLevel,
  VibeLevelChangeRecord,
} from "../../../../apps/backend/src/modules/points/points.types.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/points/points.repository.js");
jest.mock("../../../../apps/backend/src/modules/points/vibe-level.repository.js");
jest.mock("../../../../apps/backend/src/modules/points/badges.service.js");
jest.mock("../../../../apps/backend/src/modules/sessions/sessions.repository.js");
jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const createTrx = () => {
    const builder = Object.assign(Promise.resolve([]), {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });
    const callableBuilder = Object.assign(
      jest.fn((table: string) => builder),
      builder,
    );
    return callableBuilder;
  };

  const mockTransaction = jest.fn((cb: (trx: ReturnType<typeof createTrx>) => Promise<void>) =>
    cb(createTrx()),
  );

  const mockDbFunction = jest.fn((table: string) => {
    const builder = Object.assign(Promise.resolve([]), {
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });
    return Object.assign(
      jest.fn((t: string) => builder),
      builder,
    );
  }) as jest.Mock & {
    transaction: jest.Mock;
  };
  mockDbFunction.transaction = mockTransaction;

  return {
    db: mockDbFunction,
  };
});
jest.mock("../../../../apps/backend/src/observability/metrics.js", () => ({
  incrementPointsAwarded: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/jobs/services/points-jobs.service.js", () => ({
  pointsJobsService: {
    scheduleStreakEvaluation: jest.fn(),
    scheduleSeasonalEventSweep: jest.fn(),
  },
}));

const mockPointsRepo = jest.mocked(pointsRepository);
const mockVibeLevelRepo = jest.mocked(vibeLevelRepository);
const mockBadgesService = jest.mocked(badgesService);
const mockSessionsRepo = jest.mocked(sessionsRepository);

describe("Points Service", () => {
  const userId = "user-123";
  const sessionId = "session-123";

  const createMockDomainVibeLevel = (domainCode: string, vibeLevel = 1000): DomainVibeLevel => ({
    user_id: userId,
    domain_code: domainCode as any,
    vibe_level: vibeLevel,
    rating_deviation: 350,
    volatility: 0.06,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const createMockVibeLevelChangeRecord = (domainCode: string): VibeLevelChangeRecord => ({
    id: "change-1",
    user_id: userId,
    domain_code: domainCode as any,
    session_id: sessionId,
    old_vibe_level: 1000,
    new_vibe_level: 1010,
    old_rd: 350,
    new_rd: 340,
    change_amount: 10,
    performance_score: 50,
    domain_impact: 0.8,
    points_awarded: 20,
    change_reason: "session_completed",
    metadata: {},
    created_at: new Date().toISOString(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks for vibe-level service functions
    mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(new Map());
    mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(undefined);
    mockVibeLevelRepo.updateDomainVibeLevel.mockResolvedValue(undefined);
    mockVibeLevelRepo.insertVibeLevelChange.mockResolvedValue(
      createMockVibeLevelChangeRecord("strength"),
    );
    mockVibeLevelRepo.lockVibeLevelsForUser.mockResolvedValue(undefined);
  });

  describe("getPointsSummary", () => {
    it("should return points summary", async () => {
      const mockSummary: PointsSummary = {
        balance: 1000,
        recent: [
          {
            id: "event-1",
            points: 50,
            source_type: "session",
            source_id: sessionId,
            awarded_at: new Date().toISOString(),
            algorithm_version: "v1",
          },
        ],
      };

      mockPointsRepo.getPointsBalance.mockResolvedValue(1000);
      mockPointsRepo.getRecentPointsEvents.mockResolvedValue(mockSummary.recent);

      const result = await pointsService.getPointsSummary(userId);

      expect(result).toEqual(mockSummary);
      expect(mockPointsRepo.getPointsBalance).toHaveBeenCalledWith(userId);
      expect(mockPointsRepo.getRecentPointsEvents).toHaveBeenCalledWith(userId, 10);
    });
  });

  describe("getPointsHistory", () => {
    it("should return points history", async () => {
      const query: PointsHistoryQuery = {
        limit: 20,
      };

      const mockHistoryItems = [
        {
          id: "event-1",
          points: 50,
          source_type: "session",
          source_id: sessionId,
          awarded_at: new Date().toISOString(),
          algorithm_version: "v1",
        },
      ];

      mockPointsRepo.getPointsHistory.mockResolvedValue(mockHistoryItems);

      const result = await pointsService.getPointsHistory(userId, query);

      expect(result.items).toEqual(mockHistoryItems);
      expect(result.nextCursor).toBeNull();
      expect(mockPointsRepo.getPointsHistory).toHaveBeenCalled();
    });

    it("uses the last returned event as the next cursor", async () => {
      const awardedAt = "2026-09-23T10:00:00.000Z";
      const rows = [
        {
          id: "event-3",
          user_id: userId,
          points: 30,
          source_type: "session_completed",
          source_id: "session-3",
          awarded_at: awardedAt,
          algorithm_version: "v2_vibe_lvl",
          calories: null,
          metadata: {},
          created_at: awardedAt,
        },
        {
          id: "event-2",
          user_id: userId,
          points: 20,
          source_type: "session_completed",
          source_id: "session-2",
          awarded_at: awardedAt,
          algorithm_version: "v2_vibe_lvl",
          calories: null,
          metadata: {},
          created_at: awardedAt,
        },
        {
          id: "event-1",
          user_id: userId,
          points: 10,
          source_type: "session_completed",
          source_id: "session-1",
          awarded_at: awardedAt,
          algorithm_version: "v2_vibe_lvl",
          calories: null,
          metadata: {},
          created_at: awardedAt,
        },
      ];

      mockPointsRepo.getPointsHistory.mockResolvedValue(rows);

      const result = await pointsService.getPointsHistory(userId, { limit: 2 });

      expect(result.items.map((item) => item.id)).toEqual(["event-3", "event-2"]);
      expect(result.nextCursor).toBe(`${awardedAt}|event-2`);
    });

    it("should decode cursor when provided", async () => {
      const query: PointsHistoryQuery = {
        limit: 20,
        cursor: "2024-01-01T00:00:00Z|event-123",
      };

      mockPointsRepo.getPointsHistory.mockResolvedValue([]);

      await pointsService.getPointsHistory(userId, query);

      expect(mockPointsRepo.getPointsHistory).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          cursor: {
            awardedAt: new Date("2024-01-01T00:00:00Z"),
            id: "event-123",
          },
        }),
      );
    });

    it("should throw error for invalid cursor", async () => {
      const query: PointsHistoryQuery = {
        limit: 20,
        cursor: "invalid-cursor",
      };

      await expect(pointsService.getPointsHistory(userId, query)).rejects.toThrow(HttpError);
      await expect(pointsService.getPointsHistory(userId, query)).rejects.toThrow(
        "POINTS_INVALID_CURSOR",
      );
    });

    it("should clamp limit to max", async () => {
      const query: PointsHistoryQuery = {
        limit: 200, // Exceeds MAX_HISTORY_LIMIT (100)
      };

      mockPointsRepo.getPointsHistory.mockResolvedValue([]);

      await pointsService.getPointsHistory(userId, query);

      expect(mockPointsRepo.getPointsHistory).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          limit: 101, // limit + 1 for pagination check
        }),
      );
    });
  });

  describe("awardPointsForSession", () => {
    const mockSession: SessionWithExercises = {
      id: sessionId,
      owner_id: userId,
      title: "Test Session",
      planned_at: new Date().toISOString(),
      status: "completed",
      completed_at: new Date().toISOString(),
      visibility: "private",
      exercises: [],
    } as SessionWithExercises;

    it("should award points for completed session", async () => {
      const mockProfile = {
        dateOfBirth: "1990-01-01",
        fitnessLevelCode: "intermediate",
        trainingFrequency: "3-4 times per week",
      };

      // Mock vibe levels - return a map with default vibe levels for common domains
      const mockVibeLevels = new Map([
        ["strength", createMockDomainVibeLevel("strength", 1000)],
        ["endurance", createMockDomainVibeLevel("endurance", 1000)],
      ]);
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(mockVibeLevels);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(
        createMockDomainVibeLevel("strength", 1000),
      );

      mockPointsRepo.getUserPointsProfile.mockResolvedValue(mockProfile);
      mockPointsRepo.findPointsEventBySource.mockResolvedValue(null);
      mockPointsRepo.getExercisesMetadata.mockResolvedValue({
        totalDistance: 0,
        averageRpe: null,
      });
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(new Map());
      mockPointsRepo.insertPointsEvent.mockResolvedValue({
        id: "event-1",
        user_id: userId,
        points: 70,
        source_type: "session_completed",
        source_id: sessionId,
        awarded_at: new Date().toISOString(),
        algorithm_version: "v1",
        created_at: new Date().toISOString(),
      });
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockBadgesService.evaluateBadgesForSession.mockResolvedValue([]);

      const result = await pointsService.awardPointsForSession(mockSession);

      // Points are calculated from vibe level changes, not fixed calculation
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThanOrEqual(500); // Clamped to max 500
      expect(mockPointsRepo.insertPointsEvent).toHaveBeenCalled();
      expect(mockSessionsRepo.updateSession).toHaveBeenCalled();
    });

    it("should return existing points if already awarded", async () => {
      const existingEvent = {
        id: "event-1",
        user_id: userId,
        points: 50,
        source_type: "session_completed",
        source_id: sessionId,
        awarded_at: new Date().toISOString(),
        algorithm_version: "v1",
        created_at: new Date().toISOString(),
      };

      mockPointsRepo.findPointsEventBySource.mockResolvedValue(existingEvent);
      mockSessionsRepo.updateSession.mockResolvedValue(1);

      const result = await pointsService.awardPointsForSession(mockSession);

      expect(result.pointsAwarded).toBe(50);
      expect(mockPointsRepo.insertPointsEvent).not.toHaveBeenCalled();
    });

    it("should calculate points based on session metrics", async () => {
      const mockProfile = {
        dateOfBirth: "1980-01-01",
        fitnessLevel: "advanced",
        trainingFrequency: "5+ times per week",
      };

      // Mock vibe levels for endurance domain (detected from distance)
      const mockVibeLevels = new Map([["endurance", createMockDomainVibeLevel("endurance", 1000)]]);
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(mockVibeLevels);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(
        createMockDomainVibeLevel("endurance", 1000),
      );

      mockPointsRepo.getUserPointsProfile.mockResolvedValue(mockProfile);
      mockPointsRepo.findPointsEventBySource.mockResolvedValue(null);
      mockPointsRepo.getExercisesMetadata.mockResolvedValue({
        totalDistance: 5000, // 5km
        averageRpe: 7,
      });
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(new Map());
      mockPointsRepo.insertPointsEvent.mockResolvedValue({
        id: "event-1",
        user_id: userId,
        points: 100,
        source_type: "session_completed",
        source_id: sessionId,
        awarded_at: new Date().toISOString(),
        algorithm_version: "v1",
        created_at: new Date().toISOString(),
      });
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockBadgesService.evaluateBadgesForSession.mockResolvedValue([]);

      const result = await pointsService.awardPointsForSession(mockSession);

      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThanOrEqual(500); // Clamped to max 500
      expect(mockPointsRepo.insertPointsEvent).toHaveBeenCalled();
    });

    it("should handle session with calories", async () => {
      const sessionWithCalories: SessionWithExercises = {
        ...mockSession,
        calories: 500,
        completed_at: new Date().toISOString(),
      };

      const mockProfile = {
        dateOfBirth: null,
        fitnessLevel: null,
        trainingFrequency: null,
      };

      // Mock vibe levels - calories might detect endurance domain if duration is sufficient
      const mockVibeLevels = new Map([["endurance", createMockDomainVibeLevel("endurance", 1000)]]);
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(mockVibeLevels);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(
        createMockDomainVibeLevel("endurance", 1000),
      );

      mockPointsRepo.getUserPointsProfile.mockResolvedValue(mockProfile);
      mockPointsRepo.findPointsEventBySource.mockResolvedValue(null);
      mockPointsRepo.getExercisesMetadata.mockResolvedValue({
        totalDistance: 0,
        averageRpe: null,
      });
      mockVibeLevelRepo.getAllDomainVibeLevels.mockResolvedValue(new Map());
      mockPointsRepo.insertPointsEvent.mockResolvedValue({
        id: "event-1",
        user_id: userId,
        points: 75,
        source_type: "session_completed",
        source_id: sessionId,
        awarded_at: new Date().toISOString(),
        algorithm_version: "v1",
        created_at: new Date().toISOString(),
      });
      mockSessionsRepo.updateSession.mockResolvedValue(1);
      mockBadgesService.evaluateBadgesForSession.mockResolvedValue([]);

      const result = await pointsService.awardPointsForSession(sessionWithCalories);

      // Points are calculated from vibe level changes
      expect(result.pointsAwarded).toBeGreaterThan(0);
      expect(result.pointsAwarded).toBeLessThanOrEqual(500); // Clamped to max 500
    });
  });
});
