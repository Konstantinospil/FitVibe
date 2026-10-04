import { db } from "../../../../apps/backend/src/db/connection.js";
import * as progressRepository from "../../../../apps/backend/src/modules/progress/progress.repository.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = null) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
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
  };

  mockDbFunction.raw = jest.fn().mockReturnValue({});

  return {
    db: mockDbFunction,
  };
});

describe("Progress Repository", () => {
  const userId = "user-123";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("fetchSummary", () => {
    it("should fetch progress summary", async () => {
      const period = 30;
      const mockSummary = {
        sessions_completed: "10",
        total_reps: "100",
        total_volume: "5000",
        total_duration_sec: "3600",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("session_summary as ss");
      if (queryBuilders["session_summary as ss"]) {
        queryBuilders["session_summary as ss"].first = jest.fn().mockResolvedValue(mockSummary);
      }

      const result = await progressRepository.fetchSummary(userId, period);

      expect(result.period).toBe(period);
      expect(result.sessions_completed).toBe(10);
      expect(result.total_reps).toBe(100);
      expect(result.total_volume).toBe(5000);
    });
  });

  describe("fetchTrends", () => {
    it("should fetch trends by week", async () => {
      const period = 30;
      const groupBy = "week" as const;
      const mockTrends = [
        { week_start: new Date().toISOString(), sessions: "5", total_volume: "2500" },
      ];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("weekly_aggregates as wa");
      if (queryBuilders["weekly_aggregates as wa"]) {
        queryBuilders["weekly_aggregates as wa"].select = jest.fn().mockResolvedValue(mockTrends);
      }

      const result = await progressRepository.fetchTrends(userId, period, groupBy);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("fetchExerciseBreakdown", () => {
    it("should fetch exercise breakdown", async () => {
      const period = 30;
      const mockBreakdown = [
        {
          type_code: "strength",
          sessions: "5",
          total_reps: "50",
          total_volume: "2500",
          total_duration_sec: "1800",
        },
      ];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("exercise_sets as s");
      if (queryBuilders["exercise_sets as s"]) {
        // Make orderBy resolve to the breakdown (it's the last method in the chain)
        queryBuilders["exercise_sets as s"].orderBy = jest.fn().mockResolvedValue(mockBreakdown);
      }

      const result = await progressRepository.fetchExerciseBreakdown(userId, period);

      expect(Array.isArray(result)).toBe(true);
    });
  });
  describe("fetchVibePointsTrends", () => {
    it("reads canonical v2 domain points instead of splitting session points by exercise", async () => {
      const vibeRows = [
        { type_code: "strength", month_key: "2026-09", points: "35" },
        { type_code: "regeneration", month_key: "2026-09", points: "20" },
      ];
      const overallRows = [{ month_key: "2026-09", points: "55" }];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("vibe_level_changes as vlc");
      const builder = queryBuilders["vibe_level_changes as vlc"];
      builder.orderBy = jest
        .fn()
        .mockResolvedValueOnce(vibeRows)
        .mockResolvedValueOnce(overallRows);

      const result = await progressRepository.fetchVibePointsTrends(userId, 3);

      expect(dbFn).toHaveBeenCalledWith("vibe_level_changes as vlc");
      expect(builder.where).toHaveBeenCalledWith({
        "vlc.user_id": userId,
        "vlc.change_reason": "session_completed",
      });
      expect(builder.whereNotNull).toHaveBeenCalledWith("vlc.points_awarded");
      expect(result).toEqual({ vibeRows, overallRows });
    });
  });

});
