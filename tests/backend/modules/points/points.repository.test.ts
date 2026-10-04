import { db } from "../../../../apps/backend/src/db/connection.js";
import * as pointsRepository from "../../../../apps/backend/src/modules/points/points.repository.js";
import type { InsertPointsEvent } from "../../../../apps/backend/src/modules/points/points.types.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = null) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereBetween: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    countDistinct: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    sum: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    raw: jest.fn().mockReturnValue({}),
  });
  (builder as any).raw = jest.fn().mockReturnValue({});
  return builder;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDbFunction = jest.fn((table: string) => {
    if (!queryBuilders[table]) {
      queryBuilders[table] = createMockQueryBuilder();
    }
    return queryBuilders[table];
  }) as jest.Mock & {
    raw: jest.Mock;
    transaction: jest.Mock;
  };

  mockDbFunction.raw = jest.fn().mockReturnValue({});
  mockDbFunction.transaction = jest.fn((callback) => callback(mockDbFunction));

  return {
    db: mockDbFunction,
  };
});

describe("Points Repository", () => {
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("insertPointsEvent", () => {
    it("should insert points event", async () => {
      const event: InsertPointsEvent = {
        id: "event-123",
        user_id: userId,
        source_type: "session",
        source_id: sessionId,
        points: 50,
        awarded_at: new Date().toISOString(),
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("user_points");
      if (queryBuilders["user_points"]) {
        const mockEventRow = {
          id: event.id,
          user_id: event.user_id,
          source_type: event.source_type,
          source_id: event.source_id,
          points: event.points,
          awarded_at: event.awarded_at,
          created_at: new Date().toISOString(),
        };
        queryBuilders["user_points"].returning = jest.fn().mockResolvedValue([mockEventRow]);
      }

      await pointsRepository.insertPointsEvent(event);

      expect(queryBuilders["user_points"]?.insert).toHaveBeenCalled();
    });
  });

  describe("getCompletedSessionDatesInRange", () => {
    it("should get completed session dates in range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const mockDates = [
        { completed_at: new Date("2024-01-15").toISOString() },
        { completed_at: new Date("2024-01-20").toISOString() },
      ];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].select = jest.fn().mockResolvedValue(mockDates);
      }

      const result = await pointsRepository.getCompletedSessionDatesInRange(
        userId,
        startDate,
        endDate,
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe("insertPointsEvent", () => {
    it("should work with transaction", async () => {
      const event: InsertPointsEvent = {
        id: "event-123",
        user_id: userId,
        source_type: "session",
        source_id: sessionId,
        points: 50,
        awarded_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      const mockEventRow = {
        id: event.id,
        user_id: event.user_id,
        source_type: event.source_type,
        source_id: event.source_id,
        points: event.points,
        awarded_at: event.awarded_at,
        created_at: new Date().toISOString(),
      };
      newBuilder.returning.mockResolvedValue([mockEventRow]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.insertPointsEvent(event, mockTrx);

      expect(newBuilder.insert).toHaveBeenCalled();
    });
  });

  describe("findPointsEventBySource", () => {
    it("should find points event by source", async () => {
      const mockEventRow = {
        id: "event-123",
        user_id: userId,
        source_type: "session",
        source_id: sessionId,
        points: 50,
        awarded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_points"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockEventRow);

      const result = await pointsRepository.findPointsEventBySource(userId, "session", sessionId);

      expect(result).toBeDefined();
      expect(newBuilder.where).toHaveBeenCalledWith({
        user_id: userId,
        source_type: "session",
        source_id: sessionId,
      });
    });

    it("should return undefined when not found", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_points"] = newBuilder;
      newBuilder.first.mockResolvedValue(undefined);

      const result = await pointsRepository.findPointsEventBySource(userId, "session", sessionId);

      expect(result).toBeUndefined();
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.first.mockResolvedValue(undefined);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.findPointsEventBySource(userId, "session", sessionId, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getPointsBalance", () => {
    it("should get points balance", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_points"] = newBuilder;
      newBuilder.first.mockResolvedValue({ total: "150" });

      const result = await pointsRepository.getPointsBalance(userId);

      expect(result).toBe(150);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
    });

    it("should handle null result", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_points"] = newBuilder;
      newBuilder.first.mockResolvedValue(null);

      const result = await pointsRepository.getPointsBalance(userId);

      expect(result).toBe(0);
    });

    it("should handle number total", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_points"] = newBuilder;
      newBuilder.first.mockResolvedValue({ total: 200 });

      const result = await pointsRepository.getPointsBalance(userId);

      expect(result).toBe(200);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.first.mockResolvedValue({ total: "100" });
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getPointsBalance(userId, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getRecentPointsEvents", () => {
    it("should get recent points events", async () => {
      const mockEvents = [
        {
          id: "event-1",
          user_id: userId,
          source_type: "session",
          source_id: "session-1",
          points: 50,
          awarded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: "event-2",
          user_id: userId,
          source_type: "session",
          source_id: "session-2",
          points: 30,
          awarded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      const newBuilder = createMockQueryBuilder(mockEvents);
      queryBuilders["user_points"] = newBuilder;

      const result = await pointsRepository.getRecentPointsEvents(userId, 10);

      expect(result).toHaveLength(2);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.orderBy).toHaveBeenCalledWith("awarded_at", "desc");
      expect(newBuilder.orderBy).toHaveBeenCalledWith("id", "desc");
      expect(newBuilder.limit).toHaveBeenCalledWith(10);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getRecentPointsEvents(userId, 5, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getPointsHistory", () => {
    it("should get points history", async () => {
      const mockEvents = [
        {
          id: "event-1",
          user_id: userId,
          source_type: "session",
          source_id: "session-1",
          points: 50,
          awarded_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      const newBuilder = createMockQueryBuilder(mockEvents);
      queryBuilders["user_points"] = newBuilder;

      const result = await pointsRepository.getPointsHistory(userId, { limit: 10 });

      expect(result).toHaveLength(1);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.limit).toHaveBeenCalledWith(10);
    });

    it("should filter by date range", async () => {
      const newBuilder = createMockQueryBuilder([]);
      queryBuilders["user_points"] = newBuilder;
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-31");

      await pointsRepository.getPointsHistory(userId, { limit: 10, from, to });

      expect(newBuilder.andWhere).toHaveBeenCalledWith("awarded_at", ">=", from);
      expect(newBuilder.andWhere).toHaveBeenCalledWith("awarded_at", "<=", to);
    });

    it("should use cursor for pagination", async () => {
      const newBuilder = createMockQueryBuilder([]);
      queryBuilders["user_points"] = newBuilder;
      const cursor = {
        awardedAt: new Date("2024-01-15"),
        id: "event-123",
      };

      await pointsRepository.getPointsHistory(userId, { limit: 10, cursor });

      expect(newBuilder.andWhere).toHaveBeenCalled();
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getPointsHistory(userId, { limit: 10 }, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getUserPointsProfile", () => {
    it("should get user points profile", async () => {
      const mockProfile = {
        dateOfBirth: null,
        genderCode: null,
        fitnessLevelCode: null,
        trainingFrequency: null,
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("profiles");
      if (queryBuilders["profiles"]) {
        queryBuilders["profiles"].first = jest.fn().mockResolvedValue({
          date_of_birth: null,
          gender_code: null,
          fitness_level_code: null,
          training_frequency: null,
        });
      }

      const result = await pointsRepository.getUserPointsProfile(userId);

      expect(result).toEqual(mockProfile);
    });

    it("should get user points profile with data", async () => {
      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("profiles");
      if (queryBuilders["profiles"]) {
        queryBuilders["profiles"].first = jest.fn().mockResolvedValue({
          date_of_birth: "1990-01-01",
          gender_code: "male",
          fitness_level_code: "intermediate",
          training_frequency: 3,
        });
      }

      const result = await pointsRepository.getUserPointsProfile(userId);

      expect(result).toEqual({
        dateOfBirth: "1990-01-01",
        genderCode: "male",
        fitnessLevelCode: "intermediate",
        trainingFrequency: 3,
      });
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["profiles"] = newBuilder;
      newBuilder.first.mockResolvedValue({
        date_of_birth: null,
        gender_code: null,
        fitness_level_code: null,
        training_frequency: null,
      });
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getUserPointsProfile(userId, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getExercisesMetadata", () => {
    it("should get exercises metadata", async () => {
      const exerciseIds = ["exercise-1", "exercise-2"];
      const mockExercises = [
        {
          id: "exercise-1",
          type_code: "strength",
          tags: ["upper-body", "chest"],
        },
        {
          id: "exercise-2",
          type_code: "cardio",
          tags: null,
        },
      ];

      const newBuilder = createMockQueryBuilder(mockExercises);
      queryBuilders["exercises"] = newBuilder;

      const result = await pointsRepository.getExercisesMetadata(exerciseIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get("exercise-1")?.type_code).toBe("strength");
      expect(result.get("exercise-2")?.type_code).toBe("cardio");
      expect(newBuilder.whereIn).toHaveBeenCalledWith("id", exerciseIds);
    });

    it("should return empty map for empty array", async () => {
      const result = await pointsRepository.getExercisesMetadata([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getExercisesMetadata(["exercise-1"], mockTrx);

      expect(newBuilder.whereIn).toHaveBeenCalled();
    });
  });

  describe("getBadgeCatalog", () => {
    it("should get badge catalog", async () => {
      const mockBadges = [
        {
          code: "first_session",
          name: "First Session",
          description: "Complete your first session",
          category: "milestone",
          icon: "🏆",
          priority: 1,
          criteria: { sessions: 1 },
        },
      ];

      const newBuilder = createMockQueryBuilder(mockBadges);
      queryBuilders["badge_catalog"] = newBuilder;

      const result = await pointsRepository.getBadgeCatalog();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);
      expect(result.get("first_session")?.name).toBe("First Session");
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getBadgeCatalog(mockTrx);

      expect(newBuilder.select).toHaveBeenCalled();
    });
  });

  describe("getUserBadgeCodes", () => {
    it("should get user badge codes", async () => {
      const mockBadges = [{ badge_type: "first_session" }, { badge_type: "streak_7" }];

      const newBuilder = createMockQueryBuilder(mockBadges);
      queryBuilders["badges"] = newBuilder;

      const result = await pointsRepository.getUserBadgeCodes(userId);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(2);
      expect(result.has("first_session")).toBe(true);
      expect(result.has("streak_7")).toBe(true);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId, is_active: true });
    });

    it("should return empty set when no badges", async () => {
      const newBuilder = createMockQueryBuilder([]);
      queryBuilders["badges"] = newBuilder;

      const result = await pointsRepository.getUserBadgeCodes(userId);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getUserBadgeCodes(userId, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("insertBadgeAward", () => {
    it("should insert badge award", async () => {
      const award = {
        user_id: userId,
        badge_type: "first_session",
        metadata: { sessions: 1 },
      };

      const mockBadgeRow = {
        id: "badge-123",
        user_id: userId,
        badge_type: "first_session",
        metadata: { sessions: 1 },
        awarded_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["badges"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockBadgeRow]);

      const result = await pointsRepository.insertBadgeAward(award);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(userId);
      expect(result.badge_type).toBe("first_session");
      expect(newBuilder.insert).toHaveBeenCalled();
    });

    it("should work with transaction", async () => {
      const award = {
        user_id: userId,
        badge_type: "first_session",
        metadata: { sessions: 1 },
      };

      const mockBadgeRow = {
        id: "badge-123",
        user_id: userId,
        badge_type: "first_session",
        metadata: { sessions: 1 },
        awarded_at: new Date().toISOString(),
      };

      const newBuilder = createMockQueryBuilder();
      newBuilder.returning.mockResolvedValue([mockBadgeRow]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.insertBadgeAward(award, mockTrx);

      expect(newBuilder.insert).toHaveBeenCalled();
    });
  });

  describe("supersedeSessionDerivedGamification", () => {
    it("uses jsonb_exists for session-derived badge supersession", async () => {
      const builders: Record<string, ReturnType<typeof createMockQueryBuilder>> = {
        vibe_level_changes: createMockQueryBuilder(),
        user_domain_vibe_levels: createMockQueryBuilder(),
        badges: createMockQueryBuilder(),
        sessions: createMockQueryBuilder(),
      };
      const mockTrx = ((table: string) => builders[table]) as any;

      await pointsRepository.supersedeSessionDerivedGamification(userId, mockTrx);

      expect(builders.badges.where).toHaveBeenCalledWith({
        user_id: userId,
        is_active: true,
      });
      expect(builders.badges.whereRaw).toHaveBeenCalledWith(
        "jsonb_exists(metadata, ?)",
        ["session_id"],
      );
      expect(builders.badges.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          superseded_at: expect.any(String),
        }),
      );
    });
  });

  describe("countCompletedSessions", () => {
    it("should count completed sessions", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: "25" });

      const result = await pointsRepository.countCompletedSessions(userId);

      expect(result).toBe(25);
      expect(newBuilder.where).toHaveBeenCalledWith({
        owner_id: userId,
        status: "completed",
      });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
    });

    it("should handle null result", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(null);

      const result = await pointsRepository.countCompletedSessions(userId);

      expect(result).toBe(0);
    });

    it("should handle number count", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: 10 });

      const result = await pointsRepository.countCompletedSessions(userId);

      expect(result).toBe(10);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.first.mockResolvedValue({ count: "5" });
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.countCompletedSessions(userId, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getCompletedSessionDatesInRange", () => {
    it("should handle null completed_at", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const mockDates = [
        { completed_at: new Date("2024-01-15").toISOString() },
        { completed_at: null },
      ];

      const newBuilder = createMockQueryBuilder(mockDates);
      queryBuilders["sessions"] = newBuilder;

      const result = await pointsRepository.getCompletedSessionDatesInRange(
        userId,
        startDate,
        endDate,
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1); // Only one valid date
    });

    it("should work with transaction", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await pointsRepository.getCompletedSessionDatesInRange(userId, startDate, endDate, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("updateDomainVibeLevel", () => {
    it("upserts vibe level on user_id and domain_code", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["user_domain_vibe_levels"] = newBuilder;

      await pointsRepository.updateDomainVibeLevel(userId, "strength", 1100, 200, 0.05);

      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          domain_code: "strength",
          vibe_level: 1100,
          rating_deviation: 200,
          volatility: 0.05,
        }),
      );
      expect(newBuilder.onConflict).toHaveBeenCalledWith(["user_id", "domain_code"]);
      expect(newBuilder.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          vibe_level: 1100,
          rating_deviation: 200,
          volatility: 0.05,
        }),
      );
    });
  });
  describe("lockVibeLevelsForUser", () => {
    it("uses a transaction-scoped advisory lock keyed by user", async () => {
      const trx = {
        raw: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await pointsRepository.lockVibeLevelsForUser(userId, trx as any);

      expect(trx.raw).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `fitvibe:vibe-level:${userId}`,
      ]);
    });
  });

});
