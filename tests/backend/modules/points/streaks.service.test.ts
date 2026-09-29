/**
 * Unit tests for streaks service
 *
 * Tests streak calculation and bonus point awarding logic
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { Knex } from "knex";
import {
  calculateCurrentStreak,
  awardStreakBonus,
  evaluateStreakBonus,
} from "../../../../apps/backend/src/modules/points/streaks.service.js";
import * as pointsRepository from "../../../../apps/backend/src/modules/points/points.repository.js";

// Mock the db module
jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockTrx = {} as Knex.Transaction;
  const mockTransaction = jest.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
    return await callback(mockTrx);
  });
  return {
    db: {
      transaction: mockTransaction,
    },
  };
});

jest.mock("../../../../apps/backend/src/modules/points/gamification-policy.repository.js", () => ({
  getGamificationPolicy: jest.fn().mockResolvedValue({
    versionCode: "v1",
    streakLookbackDays: 90,
    streakTiers: [
      { minDays: 3, bonusPoints: 5 },
      { minDays: 7, bonusPoints: 10 },
      { minDays: 14, bonusPoints: 20 },
      { minDays: 30, bonusPoints: 50 },
    ],
  }),
}));

// Mock the points repository
jest.mock("../../../../apps/backend/src/modules/points/points.repository.js", () => ({
  getCompletedSessionDatesInRange: jest.fn(),
  findPointsEventBySource: jest.fn(),
  insertPointsEvent: jest.fn(),
}));

// Mock logger
jest.mock("../../../../apps/backend/src/config/logger.js", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Streaks Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(pointsRepository.findPointsEventBySource).mockResolvedValue(undefined);
  });

  describe("calculateCurrentStreak", () => {
    it("should return 0 when no completed sessions exist", async () => {
      jest.mocked(pointsRepository.getCompletedSessionDatesInRange).mockResolvedValue(new Set());

      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"));

      expect(result).toBe(0);
      expect(pointsRepository.getCompletedSessionDatesInRange).toHaveBeenCalledWith(
        "user-123",
        expect.any(Date),
        expect.any(Date),
        undefined,
      );
    });

    it("should calculate streak for consecutive days", async () => {
      const completedDates = new Set(["2025-01-15", "2025-01-14", "2025-01-13", "2025-01-12"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"));

      expect(result).toBe(4);
    });

    it("should stop counting when streak is broken", async () => {
      const completedDates = new Set([
        "2025-01-15",
        "2025-01-14",
        "2025-01-12", // Missing 2025-01-13 breaks streak
        "2025-01-11",
      ]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"));

      expect(result).toBe(2); // Only 15th and 14th count
    });

    it("should handle single day streak", async () => {
      const completedDates = new Set(["2025-01-15"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"));

      expect(result).toBe(1);
    });

    it("should not exceed 90 day limit", async () => {
      // Create a set with 100 consecutive days
      const completedDates = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const date = new Date("2025-01-15");
        date.setDate(date.getDate() - i);
        completedDates.add(date.toISOString().slice(0, 10));
      }
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"));

      expect(result).toBe(90); // Capped at 90
    });

    it("should work with transaction", async () => {
      const completedDates = new Set(["2025-01-15", "2025-01-14"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const mockTrx = {} as Knex.Transaction;
      const result = await calculateCurrentStreak("user-123", new Date("2025-01-15"), mockTrx);

      expect(result).toBe(2);
      expect(pointsRepository.getCompletedSessionDatesInRange).toHaveBeenCalledWith(
        "user-123",
        expect.any(Date),
        expect.any(Date),
        mockTrx,
      );
    });
  });

  describe("awardStreakBonus", () => {
    it("should return 0 for streaks less than 3 days", async () => {
      const result = await awardStreakBonus("user-123", "session-1", 2, new Date());

      expect(result).toBe(0);
      expect(pointsRepository.insertPointsEvent).not.toHaveBeenCalled();
    });

    it("returns the existing streak award instead of inserting a duplicate", async () => {
      jest.mocked(pointsRepository.findPointsEventBySource).mockResolvedValue({
        id: "existing-event",
        user_id: "user-123",
        source_type: "streak_bonus",
        source_id: "session-1",
        algorithm_version: "v1",
        points: 5,
        calories: null,
        metadata: { streak_days: 3, bonus_tier: 5 },
        awarded_at: "2025-01-15T00:00:00.000Z",
        created_at: "2025-01-15T00:00:00.000Z",
      });

      const result = await awardStreakBonus(
        "user-123",
        "session-1",
        3,
        new Date("2025-01-15"),
      );

      expect(result).toBe(5);
      expect(pointsRepository.findPointsEventBySource).toHaveBeenCalledWith(
        "user-123",
        "streak_bonus",
        "session-1",
        undefined,
      );
      expect(pointsRepository.insertPointsEvent).not.toHaveBeenCalled();
    });

    it("should award 5 points for 3-6 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 3, new Date("2025-01-15"));

      expect(result).toBe(5);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-123",
          source_type: "streak_bonus",
          source_id: "session-1",
          points: 5,
          metadata: {
            streak_days: 3,
            bonus_tier: 5,
          },
        }),
        undefined,
      );
    });

    it("should award 5 points for 6 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 6, new Date("2025-01-15"));

      expect(result).toBe(5);
    });

    it("should award 10 points for 7-13 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 7, new Date("2025-01-15"));

      expect(result).toBe(10);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          points: 10,
          metadata: expect.objectContaining({
            streak_days: 7,
            bonus_tier: 10,
          }),
        }),
        undefined,
      );
    });

    it("should award 10 points for 13 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 13, new Date("2025-01-15"));

      expect(result).toBe(10);
    });

    it("should award 20 points for 14-29 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 14, new Date("2025-01-15"));

      expect(result).toBe(20);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          points: 20,
          metadata: expect.objectContaining({
            streak_days: 14,
            bonus_tier: 20,
          }),
        }),
        undefined,
      );
    });

    it("should award 20 points for 29 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 29, new Date("2025-01-15"));

      expect(result).toBe(20);
    });

    it("should award 50 points for 30+ day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 30, new Date("2025-01-15"));

      expect(result).toBe(50);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          points: 50,
          metadata: expect.objectContaining({
            streak_days: 30,
            bonus_tier: 50,
          }),
        }),
        undefined,
      );
    });

    it("should award 50 points for 100 day streak", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await awardStreakBonus("user-123", "session-1", 100, new Date("2025-01-15"));

      expect(result).toBe(50);
    });

    it("should work with transaction", async () => {
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const mockTrx = {} as Knex.Transaction;
      const result = await awardStreakBonus(
        "user-123",
        "session-1",
        5,
        new Date("2025-01-15"),
        mockTrx,
      );

      expect(result).toBe(5);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalledWith(expect.any(Object), mockTrx);
    });
  });

  describe("evaluateStreakBonus", () => {
    it("should calculate streak and award bonus points", async () => {
      const completedDates = new Set(["2025-01-15", "2025-01-14", "2025-01-13"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await evaluateStreakBonus("user-123", "session-1", new Date("2025-01-15"));

      expect(result.streakLength).toBe(3);
      expect(result.bonusPoints).toBe(5);
      expect(pointsRepository.insertPointsEvent).toHaveBeenCalled();
    });

    it("should handle string date input", async () => {
      const completedDates = new Set(["2025-01-15"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await evaluateStreakBonus("user-123", "session-1", "2025-01-15T10:00:00Z");

      expect(result.streakLength).toBe(1);
      expect(result.bonusPoints).toBe(0); // Less than 3 days, no bonus
    });

    it("should return 0 bonus points for short streaks", async () => {
      const completedDates = new Set(["2025-01-15"]);
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);

      const result = await evaluateStreakBonus("user-123", "session-1", new Date("2025-01-15"));

      expect(result.streakLength).toBe(1);
      expect(result.bonusPoints).toBe(0);
      expect(pointsRepository.insertPointsEvent).not.toHaveBeenCalled();
    });

    it("should handle long streaks correctly", async () => {
      // Create 30 consecutive days
      const completedDates = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const date = new Date("2025-01-15");
        date.setDate(date.getDate() - i);
        completedDates.add(date.toISOString().slice(0, 10));
      }
      jest
        .mocked(pointsRepository.getCompletedSessionDatesInRange)
        .mockResolvedValue(completedDates);
      jest.mocked(pointsRepository.insertPointsEvent).mockResolvedValue(undefined);

      const result = await evaluateStreakBonus("user-123", "session-1", new Date("2025-01-15"));

      expect(result.streakLength).toBe(30);
      expect(result.bonusPoints).toBe(50);
    });
  });
});
