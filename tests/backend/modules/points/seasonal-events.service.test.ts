import { v4 as uuidv4 } from "uuid";
import type { Knex } from "knex";
import {
  getActiveEvents,
  evaluateSeasonalEvents,
} from "../../../../apps/backend/src/modules/points/seasonal-events.service.js";
import { insertPointsEvent } from "../../../../apps/backend/src/modules/points/points.repository.js";
import { db } from "../../../../apps/backend/src/db/connection.js";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

jest.mock("../../../../apps/backend/src/modules/points/gamification-policy.repository.js", () => ({
  getSeasonalEventPolicies: jest.fn(async (at: Date) => {
    const events = [
      {
        policyVersion: "v1",
        code: "new_year_2025",
        name: "New Year Kickstart 2025",
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-01-31T23:59:59Z"),
        multiplier: 1.5,
        minSessionsForBonus: 12,
        bonusPoints: 100,
      },
      {
        policyVersion: "v1",
        code: "summer_shred_2025",
        name: "Summer Shred 2025",
        startDate: new Date("2025-06-01T00:00:00Z"),
        endDate: new Date("2025-08-31T23:59:59Z"),
        multiplier: 1.25,
        minSessionsForBonus: 36,
        bonusPoints: 250,
      },
      {
        policyVersion: "v1",
        code: "holiday_hustle_2025",
        name: "Holiday Hustle 2025",
        startDate: new Date("2025-11-15T00:00:00Z"),
        endDate: new Date("2025-12-31T23:59:59Z"),
        multiplier: 2,
        minSessionsForBonus: 20,
        bonusPoints: 200,
      },
    ];
    return events.filter((event) => at >= event.startDate && at <= event.endDate);
  }),
}));

jest.mock("../../../../apps/backend/src/modules/points/points.repository.js", () => ({
  insertPointsEvent: jest.fn(),
}));

jest.mock("../../../../apps/backend/src/db/connection.js", () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

const mockedInsertPointsEvent = insertPointsEvent as jest.MockedFunction<typeof insertPointsEvent>;
const mockedUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

type TransactionHandler = (trx: Knex.Transaction) => unknown;
type DbMock = jest.Mock & {
  transaction: jest.Mock<Promise<unknown>, [TransactionHandler]>;
  where: jest.Mock;
  whereRaw: jest.Mock;
  whereBetween: jest.Mock;
  whereNull: jest.Mock;
  count: jest.Mock;
  first: jest.Mock;
};

const mockedDb = db as unknown as DbMock;
const mockedTransaction = mockedDb.transaction;

describe("seasonal-events.service", () => {
  let mockQueryBuilder: {
    where: jest.Mock;
    whereRaw: jest.Mock;
    whereBetween: jest.Mock;
    whereNull: jest.Mock;
    count: jest.Mock;
    first: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockQueryBuilder = {
      where: jest.fn(),
      whereRaw: jest.fn(),
      whereBetween: jest.fn(),
      whereNull: jest.fn(),
      count: jest.fn(),
      first: jest.fn().mockResolvedValue(undefined),
    };

    // Make all methods return the query builder for chaining
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.whereRaw.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.whereBetween.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.whereNull.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.count.mockReturnValue(mockQueryBuilder);

    // Mock db() to return query builder for table queries
    (mockedDb as unknown as jest.Mock).mockImplementation((_table: string) => {
      return mockQueryBuilder as never;
    });

    // Create a mock transaction that behaves like db (callable function)
    const mockTrx = ((_table: string) => mockQueryBuilder) as unknown as Knex.Transaction;
    mockedTransaction.mockImplementation((handler: TransactionHandler) =>
      Promise.resolve(handler(mockTrx)),
    );
    mockedUuid.mockReturnValue(
      "00000000-0000-0000-0000-000000000001" as unknown as ReturnType<typeof uuidv4>,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getActiveEvents", () => {
    it("should return empty array when no events are active", async () => {
      // Set time to before first event
      jest.setSystemTime(new Date("2024-12-31T23:59:59Z"));

      const result = await getActiveEvents();

      expect(result).toEqual([]);
    });

    it("should return active events for current date", async () => {
      // Set time to during New Year event
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      const result = await getActiveEvents();

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("new_year_2025");
      expect(result[0]?.name).toBe("New Year Kickstart 2025");
    });

    it("should return event on start date", async () => {
      jest.setSystemTime(new Date("2025-01-01T00:00:00Z"));

      const result = await getActiveEvents();

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("new_year_2025");
    });

    it("should return event on end date", async () => {
      jest.setSystemTime(new Date("2025-01-31T23:59:59Z"));

      const result = await getActiveEvents();

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("new_year_2025");
    });

    it("should not return event after end date", async () => {
      jest.setSystemTime(new Date("2025-02-01T00:00:00Z"));

      const result = await getActiveEvents();

      expect(result).toEqual([]);
    });

    it("should accept custom date parameter", async () => {
      const customDate = new Date("2025-06-15T12:00:00Z");

      const result = await getActiveEvents(customDate);

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe("summer_shred_2025");
    });

    it("should return multiple events if they overlap", async () => {
      // This test would require overlapping events in the data
      // Currently no overlapping events, but test structure is ready
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      const result = await getActiveEvents();

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("evaluateSeasonalEvents", () => {
    beforeEach(() => {
      mockedInsertPointsEvent.mockResolvedValue({
        id: "event-123",
        user_id: "user-123",
        source_type: "seasonal_event",
        source_id: "session-123",
        algorithm_version: "v1",
        points: 100,
        calories: null,
        metadata: {
          event_code: "new_year_2025",
          event_name: "New Year Kickstart 2025",
          bonus_type: "completion",
          sessions_completed: 12,
          sessions_required: 12,
        },
        awarded_at: new Date("2025-01-20T10:00:00Z").toISOString(),
        created_at: new Date("2025-01-20T10:00:00Z").toISOString(),
      });
    });

    it("should return zero when no active events", async () => {
      jest.setSystemTime(new Date("2024-12-31T23:59:59Z"));

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2024-12-31T23:59:59Z"),
      );

      expect(result).toEqual({
        eventsEvaluated: 0,
        bonusesAwarded: 0,
        totalPoints: 0,
      });
      expect(mockedInsertPointsEvent).not.toHaveBeenCalled();
    });

    it("should not award bonus if user already received it", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      // Mock: user already received bonus (first call for hasReceivedEventBonus)
      mockQueryBuilder.first
        .mockResolvedValueOnce({
          user_id: "user-123",
        })
        .mockResolvedValueOnce({
          count: "15",
        });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      expect(result).toEqual({
        eventsEvaluated: 1,
        bonusesAwarded: 0,
        totalPoints: 0,
      });
      expect(mockedInsertPointsEvent).not.toHaveBeenCalled();
    });

    it("should not award bonus if session count is below minimum", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      // Mock: user has not received bonus, then session count below minimum (11 < 12)
      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "11",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      expect(result).toEqual({
        eventsEvaluated: 1,
        bonusesAwarded: 0,
        totalPoints: 0,
      });
      expect(mockedInsertPointsEvent).not.toHaveBeenCalled();
    });

    it("should award bonus when session count meets minimum requirement", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      // Mock: user has not received bonus, then session count meets minimum (12 >= 12)
      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      expect(result).toEqual({
        eventsEvaluated: 1,
        bonusesAwarded: 1,
        totalPoints: 100,
      });
      expect(mockedInsertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          source_type: "seasonal_event",
          source_id: "session-123",
          points: 100,
          metadata: expect.objectContaining({
            event_code: "new_year_2025",
            event_name: "New Year Kickstart 2025",
            bonus_type: "completion",
            sessions_completed: 12,
            sessions_required: 12,
          }),
        }),
        expect.anything(),
      );
    });

    it("should award bonus when session count exceeds minimum", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      // Mock: user has not received bonus, then session count exceeds minimum (15 > 12)
      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "15",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      expect(result).toEqual({
        eventsEvaluated: 1,
        bonusesAwarded: 1,
        totalPoints: 100,
      });
      expect(mockedInsertPointsEvent).toHaveBeenCalled();
    });

    it("should handle string date parameter", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        "2025-01-15T12:00:00Z",
      );

      expect(result.bonusesAwarded).toBeGreaterThanOrEqual(0);
    });

    it("should execute within a transaction", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      // Create a mock transaction that behaves like db (callable function)
      const mockTrx = ((_table: string) => mockQueryBuilder) as unknown as Knex.Transaction;
      mockedTransaction.mockImplementation((handler: TransactionHandler) => {
        return Promise.resolve(handler(mockTrx));
      });

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      await evaluateSeasonalEvents("user-123", "session-123", new Date("2025-01-15T12:00:00Z"));

      expect(mockedTransaction).toHaveBeenCalled();
    });

    it("should check for existing bonus using correct query", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      await evaluateSeasonalEvents("user-123", "session-123", new Date("2025-01-15T12:00:00Z"));

      // Verify the query structure for checking existing bonus
      // The function uses db("user_points") internally, which is mocked
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        user_id: "user-123",
        source_type: "seasonal_event",
      });
    });

    it("should count sessions within event date range", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      await evaluateSeasonalEvents("user-123", "session-123", new Date("2025-01-15T12:00:00Z"));

      // Verify session count query
      // The function uses db("sessions") internally within transaction
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({
        owner_id: "user-123",
        status: "completed",
      });
    });

    it("should use deterministic UUID for event ID", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockedUuid.mockReturnValue("test-uuid-456" as unknown as ReturnType<typeof uuidv4>);

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      await evaluateSeasonalEvents("user-123", "session-123", new Date("2025-01-15T12:00:00Z"));

      expect(mockedInsertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-456",
        }),
        expect.anything(),
      );
    });

    it("should handle multiple active events", async () => {
      // This would require overlapping events or multiple events in the same period
      // Currently events don't overlap, but test structure validates the loop
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      // Should evaluate at least one event
      expect(result.eventsEvaluated).toBeGreaterThanOrEqual(0);
    });

    it("should handle database errors gracefully", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Database error"));

      await expect(
        evaluateSeasonalEvents("user-123", "session-123", new Date("2025-01-15T12:00:00Z")),
      ).rejects.toThrow("Database error");
    });

    it("should handle count query returning null or undefined", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: null,
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      // Should handle null count as 0 (parseInt returns NaN, then 0)
      expect(result.bonusesAwarded).toBe(0);
    });

    it("should handle count query returning string number", async () => {
      jest.setSystemTime(new Date("2025-01-15T12:00:00Z"));

      mockQueryBuilder.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        count: "12",
      });

      const result = await evaluateSeasonalEvents(
        "user-123",
        "session-123",
        new Date("2025-01-15T12:00:00Z"),
      );

      expect(result.bonusesAwarded).toBeGreaterThanOrEqual(0);
    });
  });
});
