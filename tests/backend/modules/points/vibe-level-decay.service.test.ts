import * as decayService from "../../../../apps/backend/src/jobs/services/vibe-level-decay.service.js";
import * as vibeLevelRepository from "../../../../apps/backend/src/modules/points/vibe-level.repository.js";
import type { DomainVibeLevel } from "../../../../apps/backend/src/modules/points/points.types.js";

jest.mock("../../../../apps/backend/src/modules/points/vibe-level.repository.js");

type MockTransaction = jest.Mock & {
  raw: jest.Mock;
  transaction: jest.Mock;
};

function createMockTransaction(): MockTransaction {
  const trx = jest.fn() as MockTransaction;
  trx.raw = jest.fn().mockResolvedValue({ rows: [{ acquired: true }] });
  trx.transaction = jest.fn((callback) => Promise.resolve(callback(trx)));
  return trx;
}

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockDb = {
    transaction: jest.fn((callback) => Promise.resolve(callback(createMockTransaction()))),
  };

  return { db: mockDb };
});

const mockVibeLevelRepo = jest.mocked(vibeLevelRepository);

import { db } from "../../../../apps/backend/src/db/connection.js";
const mockDb = db as unknown as { transaction: jest.Mock };

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function createRating(overrides: Partial<DomainVibeLevel> = {}): DomainVibeLevel {
  const timestamp = daysAgo(2);
  return {
    user_id: "user-1",
    domain_code: "strength",
    vibe_level: 1500,
    rating_deviation: 50,
    volatility: 0.06,
    last_updated_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

describe("Vibe Level Decay Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([]);
    mockVibeLevelRepo.lockVibeLevelsForUser.mockResolvedValue(undefined);
    mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(undefined);
    mockVibeLevelRepo.updateDomainVibeLevel.mockResolvedValue(undefined);
  });

  describe("applyVibeLevelDecay", () => {
    it("applies decay from the rating re-read under the user lock", async () => {
      const rating = createRating();
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([rating]);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(rating);

      const result = await decayService.applyVibeLevelDecay();

      expect(result).toEqual({ skipped: false, decayed: 1 });
      expect(mockVibeLevelRepo.lockVibeLevelsForUser).toHaveBeenCalledWith(
        "user-1",
        expect.anything(),
      );
      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalledWith(
        "user-1",
        "strength",
        1498,
        54,
        expect.any(Number),
        expect.anything(),
      );
      expect(mockVibeLevelRepo.insertVibeLevelChange).toHaveBeenCalledWith(
        expect.objectContaining({
          old_vibe_level: 1500,
          new_vibe_level: 1498,
          change_amount: -2,
          change_reason: "decay",
        }),
        expect.anything(),
      );
    });

    it("skips a candidate that became fresh before the user lock was acquired", async () => {
      const staleCandidate = createRating({ last_updated_at: daysAgo(2) });
      const freshCurrent = createRating({
        vibe_level: 1510,
        last_updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      });
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([staleCandidate]);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(freshCurrent);

      const result = await decayService.applyVibeLevelDecay();

      expect(result).toEqual({ skipped: false, decayed: 0 });
      expect(mockVibeLevelRepo.lockVibeLevelsForUser).toHaveBeenCalled();
      expect(mockVibeLevelRepo.updateDomainVibeLevel).not.toHaveBeenCalled();
      expect(mockVibeLevelRepo.insertVibeLevelChange).not.toHaveBeenCalled();
    });

    it("recomputes decay from the locked current value instead of the stale scan snapshot", async () => {
      const timestamp = daysAgo(2);
      const staleCandidate = createRating({ vibe_level: 1500, last_updated_at: timestamp });
      const lockedCurrent = createRating({ vibe_level: 1600, last_updated_at: timestamp });
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([staleCandidate]);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(lockedCurrent);

      await decayService.applyVibeLevelDecay();

      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalledWith(
        "user-1",
        "strength",
        1598,
        54,
        expect.any(Number),
        expect.anything(),
      );
    });

    it("skips when another decay run holds the global advisory lock", async () => {
      mockDb.transaction.mockImplementationOnce((callback) => {
        const trx = createMockTransaction();
        trx.raw.mockResolvedValueOnce({ rows: [{ acquired: false }] });
        return Promise.resolve(callback(trx));
      });

      const result = await decayService.applyVibeLevelDecay();

      expect(result).toEqual({ skipped: true, decayed: 0 });
      expect(mockVibeLevelRepo.getStaleDomainVibeLevels).not.toHaveBeenCalled();
      expect(mockVibeLevelRepo.updateDomainVibeLevel).not.toHaveBeenCalled();
    });

    it("caps long inactivity decay and rating-deviation growth", async () => {
      const rating = createRating({ last_updated_at: daysAgo(60) });
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([rating]);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(rating);

      await decayService.applyVibeLevelDecay();

      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalledWith(
        "user-1",
        "strength",
        1450,
        100,
        expect.any(Number),
        expect.anything(),
      );
    });

    it("does not decay below the minimum vibe level", async () => {
      const rating = createRating({
        vibe_level: 105,
        last_updated_at: daysAgo(10),
      });
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([rating]);
      mockVibeLevelRepo.getDomainVibeLevel.mockResolvedValue(rating);

      await decayService.applyVibeLevelDecay();

      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalledWith(
        "user-1",
        "strength",
        100,
        expect.any(Number),
        expect.any(Number),
        expect.anything(),
      );
    });

    it("continues processing other ratings when one decay fails", async () => {
      const first = createRating({
        user_id: "user-1",
        domain_code: "strength",
      });
      const second = createRating({
        user_id: "user-2",
        domain_code: "endurance",
      });
      mockVibeLevelRepo.getStaleDomainVibeLevels.mockResolvedValue([first, second]);
      mockVibeLevelRepo.getDomainVibeLevel
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);
      mockVibeLevelRepo.updateDomainVibeLevel
        .mockRejectedValueOnce(new Error("write failed"))
        .mockResolvedValueOnce(undefined);

      const result = await decayService.applyVibeLevelDecay();

      expect(result).toEqual({ skipped: false, decayed: 1 });
      expect(mockVibeLevelRepo.updateDomainVibeLevel).toHaveBeenCalledTimes(2);
      expect(mockVibeLevelRepo.insertVibeLevelChange).toHaveBeenCalledTimes(1);
    });
  });
});
