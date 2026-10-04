import { db } from "../../../../apps/backend/src/db/connection.js";
import * as sessionsRepository from "../../../../apps/backend/src/modules/sessions/sessions.repository.js";
import type {
  Session,
  SessionQuery,
} from "../../../../apps/backend/src/modules/sessions/sessions.types.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = []) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    andWhereILike: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    clone: jest.fn().mockImplementation(function (this: any) {
      return this;
    }),
    count: jest.fn().mockResolvedValue([{ count: "0" }]),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    returning: jest.fn().mockResolvedValue([]),
    raw: jest.fn().mockReturnValue({}),
  });
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

describe("Sessions Repository", () => {
  const userId = "user-123";
  const sessionId = "session-123";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("listSessions", () => {
    it("should list sessions with default query", async () => {
      const query: SessionQuery = {};
      const mockSessions: Session[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "0" }]);
        // Make orderBy().limit().offset() chainable
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue(mockSessions);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      const result = await sessionsRepository.listSessions(userId, query);

      expect(result.data).toEqual(mockSessions);
      expect(result.total).toBe(0);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it("should filter by status", async () => {
      const query: SessionQuery = { status: "completed" };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "1" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      await sessionsRepository.listSessions(userId, query);

      expect(queryBuilders["sessions"]?.andWhere).toHaveBeenCalledWith({ status: "completed" });
    });

    it("should filter by plan_id", async () => {
      const query: SessionQuery = { plan_id: "plan-123" };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "1" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      await sessionsRepository.listSessions(userId, query);

      expect(queryBuilders["sessions"]?.andWhere).toHaveBeenCalledWith({ plan_id: "plan-123" });
    });

    it("should filter by planned_from", async () => {
      const query: SessionQuery = { planned_from: "2024-01-01T00:00:00Z" };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "1" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      await sessionsRepository.listSessions(userId, query);

      expect(queryBuilders["sessions"]?.andWhere).toHaveBeenCalledWith(
        "planned_at",
        ">=",
        "2024-01-01T00:00:00Z",
      );
    });

    it("should filter by planned_to", async () => {
      const query: SessionQuery = { planned_to: "2024-12-31T23:59:59Z" };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "1" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      await sessionsRepository.listSessions(userId, query);

      expect(queryBuilders["sessions"]?.andWhere).toHaveBeenCalledWith(
        "planned_at",
        "<=",
        "2024-12-31T23:59:59Z",
      );
    });

    it("should filter by search", async () => {
      const query: SessionQuery = { search: "test" };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "1" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      await sessionsRepository.listSessions(userId, query);

      expect(queryBuilders["sessions"]?.andWhereILike).toHaveBeenCalledWith("title", "%test%");
    });

    it("should handle custom limit and offset", async () => {
      const query: SessionQuery = { limit: 20, offset: 10 };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].count.mockResolvedValue([{ count: "5" }]);
        queryBuilders["sessions"].orderBy.mockReturnThis();
        queryBuilders["sessions"].limit.mockReturnThis();
        queryBuilders["sessions"].offset.mockResolvedValue([]);
        queryBuilders["sessions"].clone.mockImplementation(function (this: any) {
          return this;
        });
      }

      const result = await sessionsRepository.listSessions(userId, query);

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(10);
    });
  });

  describe("getSessionById", () => {
    it("should get session by id", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("sessions");
      if (queryBuilders["sessions"]) {
        queryBuilders["sessions"].first.mockResolvedValue(mockSession);
      }

      const result = await sessionsRepository.getSessionById(sessionId, userId);

      expect(result).toEqual(mockSession);
      expect(queryBuilders["sessions"]?.where).toHaveBeenCalledWith({
        id: sessionId,
        owner_id: userId,
      });
    });

    it("should include deleted when option set", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);

      await sessionsRepository.getSessionById(sessionId, userId, { includeDeleted: true });

      expect(newBuilder.whereNull).not.toHaveBeenCalled();
    });
  });

  describe("getSessionWithDetails", () => {
    it("should get session with details", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      queryBuilders["session_exercises as se"] = newBuilder;
      queryBuilders["exercise_sets"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);
      newBuilder.select.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await sessionsRepository.getSessionWithDetails(sessionId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(sessionId);
      expect(result?.exercises).toEqual([]);
    });

    it("should return undefined when session not found", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.first.mockResolvedValue(undefined);

      const result = await sessionsRepository.getSessionWithDetails(sessionId, userId);

      expect(result).toBeUndefined();
    });

    it("should handle empty exerciseIds case", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      queryBuilders["session_exercises as se"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);
      newBuilder.select.mockResolvedValueOnce([]); // Empty exercise rows

      const result = await sessionsRepository.getSessionWithDetails(sessionId, userId);

      expect(result).toBeDefined();
      expect(result?.exercises).toEqual([]);
      // Should not call exercise_sets query when exerciseIds is empty
      expect(newBuilder.whereIn).not.toHaveBeenCalled();
    });

    it("should handle exercises with Date objects for created_at and updated_at", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const mockExerciseRow = {
        id: "exercise-1",
        session_id: sessionId,
        exercise_id: "ex-1",
        order_index: 0,
        notes: "Test notes",
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-02"),
        planned_sets: 3,
        planned_reps: 10,
        planned_load: 100,
        planned_distance: null,
        planned_duration: null,
        planned_rpe: null,
        planned_rest: null,
        planned_extras: {},
        actual_sets: null,
        actual_reps: null,
        actual_load: null,
        actual_distance: null,
        actual_duration: null,
        actual_rpe: null,
        actual_rest: null,
        actual_extras: null,
        actual_recorded_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      queryBuilders["session_exercises as se"] = newBuilder;
      queryBuilders["exercise_sets"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);
      newBuilder.select.mockResolvedValueOnce([mockExerciseRow]).mockResolvedValueOnce([]); // Empty sets

      const result = await sessionsRepository.getSessionWithDetails(sessionId, userId);

      expect(result).toBeDefined();
      expect(result?.exercises).toHaveLength(1);
      expect(result?.exercises[0].created_at).toBeDefined();
      expect(result?.exercises[0].updated_at).toBeDefined();
    });

    it("should handle exercises with string dates for created_at and updated_at", async () => {
      const mockSession: Session = {
        id: sessionId,
        owner_id: userId,
        title: "Test Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const mockExerciseRow = {
        id: "exercise-1",
        session_id: sessionId,
        exercise_id: "ex-1",
        order_index: 0,
        notes: "Test notes",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        planned_sets: null,
        planned_reps: null,
        planned_load: null,
        planned_distance: null,
        planned_duration: null,
        planned_rpe: null,
        planned_rest: null,
        planned_extras: null,
        actual_sets: null,
        actual_reps: null,
        actual_load: null,
        actual_distance: null,
        actual_duration: null,
        actual_rpe: null,
        actual_rest: null,
        actual_extras: null,
        actual_recorded_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      queryBuilders["session_exercises as se"] = newBuilder;
      queryBuilders["exercise_sets"] = newBuilder;
      newBuilder.first.mockResolvedValue(mockSession);
      newBuilder.select.mockResolvedValueOnce([mockExerciseRow]).mockResolvedValueOnce([]); // Empty sets

      const result = await sessionsRepository.getSessionWithDetails(sessionId, userId);

      expect(result).toBeDefined();
      expect(result?.exercises).toHaveLength(1);
      expect(result?.exercises[0].created_at).toBe("2024-01-01T00:00:00Z");
      expect(result?.exercises[0].updated_at).toBe("2024-01-02T00:00:00Z");
    });
  });

  describe("createSession", () => {
    it("should create session", async () => {
      const sessionRow: Session = {
        id: sessionId,
        owner_id: userId,
        title: "New Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.insert.mockResolvedValue(1);

      const result = await sessionsRepository.createSession(sessionRow);

      expect(result).toBe(1);
      expect(newBuilder.insert).toHaveBeenCalledWith(sessionRow);
    });

    it("should work with transaction", async () => {
      const sessionRow: Session = {
        id: sessionId,
        owner_id: userId,
        title: "New Session",
        planned_at: new Date().toISOString(),
        status: "planned",
        visibility: "private",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.insert.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await sessionsRepository.createSession(sessionRow, mockTrx);

      expect(newBuilder.insert).toHaveBeenCalled();
    });
  });

  describe("updateSession", () => {
    it("should update session", async () => {
      const updates: Partial<Session> = {
        title: "Updated Session",
        status: "completed",
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await sessionsRepository.updateSession(sessionId, userId, updates);

      expect(newBuilder.where).toHaveBeenCalledWith({
        id: sessionId,
        owner_id: userId,
      });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updated_at: expect.any(String),
        }),
      );
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await sessionsRepository.updateSession(sessionId, userId, { title: "Updated" }, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("cancelSession", () => {
    it("should cancel session", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const result = await sessionsRepository.cancelSession(sessionId, userId);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({
        id: sessionId,
        owner_id: userId,
      });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "canceled",
          deleted_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      );
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["sessions"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await sessionsRepository.cancelSession(sessionId, userId, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("refreshSessionSummary", () => {
    it("should refresh session summary", async () => {
      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock & { raw: jest.Mock };
      dbFn.raw.mockResolvedValue({});

      await sessionsRepository.refreshSessionSummary();

      expect(dbFn.raw).toHaveBeenCalledWith("SELECT public.refresh_session_summary(?)", [true]);
    });

    it("should refresh session summary with concurrent false", async () => {
      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock & { raw: jest.Mock };
      dbFn.raw.mockResolvedValue({});

      await sessionsRepository.refreshSessionSummary(false);

      expect(dbFn.raw).toHaveBeenCalledWith("SELECT public.refresh_session_summary(?)", [false]);
    });
  });

  describe("sessionsExistAtDates", () => {
    it("should return existing session dates", async () => {
      const plannedDates = ["2024-01-15T10:00:00Z", "2024-01-16T10:00:00Z"];
      const mockRows = [
        { planned_at: "2024-01-15T10:00:00Z" },
        { planned_at: new Date("2024-01-16T10:00:00Z") },
      ];

      const newBuilder = createMockQueryBuilder(mockRows);
      queryBuilders["sessions"] = newBuilder;

      const result = await sessionsRepository.sessionsExistAtDates(userId, plannedDates);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("2024-01-15T10:00:00.000Z");
      expect(newBuilder.where).toHaveBeenCalledWith({ owner_id: userId });
      expect(newBuilder.whereIn).toHaveBeenCalledWith("planned_at", plannedDates);
    });

    it("should return empty array for empty input", async () => {
      const result = await sessionsRepository.sessionsExistAtDates(userId, []);

      expect(result).toEqual([]);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await sessionsRepository.sessionsExistAtDates(userId, ["2024-01-15"], mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("listSessionSets", () => {
    it("should list session sets", async () => {
      const mockSets = [
        {
          id: "set-1",
          exercise_id: "exercise-1",
          exercise_name: "Test Exercise",
          type_code: "strength",
          order_index: 0,
          reps: 10,
          weight_kg: 100,
          distance_m: null,
          duration_sec: null,
          rpe: null,
          notes: null,
        },
      ];

      const newBuilder = createMockQueryBuilder(mockSets);
      queryBuilders["exercise_sets as s"] = newBuilder;

      const result = await sessionsRepository.listSessionSets(sessionId);

      expect(result).toEqual(mockSets);
      expect(newBuilder.leftJoin).toHaveBeenCalled();
      expect(newBuilder.where).toHaveBeenCalledWith("se.session_id", sessionId);
      expect(newBuilder.orderBy).toHaveBeenCalled();
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder([]);
      queryBuilders["exercise_sets as s"] = newBuilder;
      const mockTrx = ((_table: string) => newBuilder) as any;

      await sessionsRepository.listSessionSets(sessionId, mockTrx);

      expect(newBuilder.leftJoin).toHaveBeenCalled();
    });
  });

  describe("replaceSessionExercises", () => {
    it("should replace session exercises", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: "Test notes",
          planned: {
            sets: 3,
            reps: 10,
            load: 100,
            distance: null,
            duration: null,
            rpe: null,
            rest: null,
            extras: {},
          },
          sets: [],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      expect(mockTrxQueryBuilder.where).toHaveBeenCalledWith({ session_id: sessionId });
      expect(mockTrxQueryBuilder.del).toHaveBeenCalled();
      expect(mockTrxQueryBuilder.insert).toHaveBeenCalled();
    });

    it("should handle empty exercises array", async () => {
      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, []);

      expect(mockTrxQueryBuilder.where).toHaveBeenCalledWith({ session_id: sessionId });
      expect(mockTrxQueryBuilder.del).toHaveBeenCalled();
      expect(mockTrxQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it("should insert planned attributes", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: {
            sets: 3,
            reps: 10,
            load: 100,
            distance: null,
            duration: null,
            rpe: null,
            rest: null,
            extras: {},
          },
          sets: [],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(2); // session_exercises + planned_attributes
    });

    it("should persist canonical performed-set metadata", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: null,
          sets: [
            {
              id: "set-1",
              order_index: 1,
              reps: 10,
              weight_kg: 100,
              distance_m: 5000,
              duration_sec: 1800,
              rpe: 7,
              rest_sec: 120,
              extras: { source: "legacy-actual" },
              recorded_at: "2026-09-22T18:30:00.000Z",
              notes: null,
            },
          ],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(2);
      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          session_exercise_id: "exercise-1",
          rest_sec: 120,
          extras: { source: "legacy-actual" },
          recorded_at: "2026-09-22T18:30:00.000Z",
        }),
      ]);
    });

    it("should insert exercise sets", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: null,
          sets: [
            {
              id: "set-1",
              order_index: 1,
              reps: 10,
              weight_kg: 100,
              distance_m: null,
              duration_sec: null,
              rpe: null,
              notes: null,
            },
          ],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(2); // session_exercises + exercise_sets
    });

    it("should not insert planned attributes when they are null", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: null,
          sets: [],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      // Should only insert session_exercises, not planned_attributes
      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(1);
    });

    it("should not insert planned attributes when they are empty", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: {
            sets: null,
            reps: null,
            load: null,
            distance: null,
            duration: null,
            rpe: null,
            rest: null,
            extras: {},
          },
          sets: [],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      // Should only insert session_exercises, not planned_attributes (because it's empty)
      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(1);
    });

    it("should not insert sets when sets array is empty", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: {
            sets: 3,
            reps: 10,
            load: 100,
            distance: null,
            duration: null,
            rpe: null,
            rest: null,
            extras: {},
          },
          sets: [],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      // Should insert session_exercises + planned_attributes, but not exercise_sets
      expect(mockTrxQueryBuilder.insert).toHaveBeenCalledTimes(2);
    });

    it("should preserve recorded_at on canonical exercise sets", async () => {
      const exercises = [
        {
          id: "exercise-1",
          exercise_id: "ex-1",
          order_index: 1,
          notes: null,
          planned: null,
          sets: [
            {
              id: "set-1",
              order_index: 1,
              reps: 10,
              weight_kg: 100,
              distance_m: null,
              duration_sec: null,
              rpe: null,
              rest_sec: null,
              extras: {},
              recorded_at: "2024-01-01T00:00:00Z",
              notes: null,
            },
          ],
        },
      ];

      const mockTrxQueryBuilder = createMockQueryBuilder();
      const mockTrx = ((_table: string) => mockTrxQueryBuilder) as any;

      mockTrxQueryBuilder.del.mockResolvedValue(1);
      mockTrxQueryBuilder.insert.mockResolvedValue([]);

      await sessionsRepository.replaceSessionExercises(mockTrx, sessionId, exercises);

      const recordedAtInsert = mockTrxQueryBuilder.insert.mock.calls.find(
        (call) =>
          Array.isArray(call[0]) &&
          call[0].some(
            (row: { recorded_at?: string }) => row.recorded_at === "2024-01-01T00:00:00Z",
          ),
      );
      expect(recordedAtInsert).toBeDefined();
    });
  });
});
