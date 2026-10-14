import { v4 as uuidv4 } from "uuid";
import * as plansService from "../../../../apps/backend/src/modules/plans/plans.service.js";
import * as plansRepository from "../../../../apps/backend/src/modules/plans/plans.repository.js";
import type { PlanRow } from "../../../../apps/backend/src/modules/plans/plans.repository.js";
import { db } from "../../../../apps/backend/src/db/connection.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

jest.mock("uuid", () => ({
  v4: jest.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

jest.mock("../../../../apps/backend/src/modules/plans/plans.repository.js", () => ({
  findPlanById: jest.fn(),
  listPlans: jest.fn(),
  createPlan: jest.fn(),
  updatePlan: jest.fn(),
  archivePlan: jest.fn(),
  deletePlan: jest.fn(),
  updatePlanProgress: jest.fn(),
  countUserPlans: jest.fn(),
}));

jest.mock("../../../../apps/backend/src/db/connection.js", () => {
  const mockRaw = jest.fn((sql: string) => sql);
  const mockDb = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn(),
  }));
  (mockDb as { raw: jest.Mock }).raw = mockRaw;
  return { db: mockDb };
});

const mockedFindPlanById = plansRepository.findPlanById as jest.MockedFunction<
  typeof plansRepository.findPlanById
>;
const mockedListPlans = plansRepository.listPlans as jest.MockedFunction<
  typeof plansRepository.listPlans
>;
const mockedCreatePlan = plansRepository.createPlan as jest.MockedFunction<
  typeof plansRepository.createPlan
>;
const mockedUpdatePlan = plansRepository.updatePlan as jest.MockedFunction<
  typeof plansRepository.updatePlan
>;
const mockedArchivePlan = plansRepository.archivePlan as jest.MockedFunction<
  typeof plansRepository.archivePlan
>;
const mockedDeletePlan = plansRepository.deletePlan as jest.MockedFunction<
  typeof plansRepository.deletePlan
>;
const mockedUpdatePlanProgress = plansRepository.updatePlanProgress as jest.MockedFunction<
  typeof plansRepository.updatePlanProgress
>;
const mockedCountUserPlans = plansRepository.countUserPlans as jest.MockedFunction<
  typeof plansRepository.countUserPlans
>;
const mockedDb = db as jest.MockedFunction<typeof db> & { raw: jest.Mock };
const mockedUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

// Helper to create a valid PlanRow mock
const createMockPlan = (overrides?: Partial<PlanRow>): PlanRow => ({
  id: "plan-1",
  user_id: "user-123",
  name: "Test Plan",
  status: "active",
  progress_percent: "0",
  session_count: 0,
  completed_count: 0,
  start_date: null,
  end_date: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived_at: null,
  revision: 1,
  ...overrides,
});

describe("Plans Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUuid.mockReturnValue(
      "00000000-0000-0000-0000-000000000001" as unknown as ReturnType<typeof uuidv4>,
    );
  });

  describe("getPlanById", () => {
    it("should return plan when found and user owns it", async () => {
      const mockPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(mockPlan);

      const result = await plansService.getPlanById("user-123", "plan-1");

      expect(result).toEqual(mockPlan);
      expect(mockedFindPlanById).toHaveBeenCalledWith("plan-1");
    });

    it("should throw 404 when plan not found", async () => {
      mockedFindPlanById.mockResolvedValue(undefined);

      const error = await plansService.getPlanById("user-123", "plan-1").catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });

    it("should throw 403 when user does not own plan", async () => {
      const mockPlan = createMockPlan({ user_id: "user-456" }); // Different user

      mockedFindPlanById.mockResolvedValue(mockPlan);

      await expect(plansService.getPlanById("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.getPlanById("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.FORBIDDEN");
    });
  });

  describe("listUserPlans", () => {
    it("should list plans for user", async () => {
      const mockPlans = [createMockPlan({ name: "Plan 1" })];

      mockedListPlans.mockResolvedValue(mockPlans);

      const result = await plansService.listUserPlans("user-123");

      expect(result).toEqual(mockPlans);
      expect(mockedListPlans).toHaveBeenCalledWith(
        { userId: "user-123" },
        { limit: undefined, offset: undefined },
      );
    });

    it("should apply filters when provided", async () => {
      const mockPlans: never[] = [];
      mockedListPlans.mockResolvedValue(mockPlans);

      await plansService.listUserPlans("user-123", {
        status: "active",
        includeArchived: false,
        search: "test",
        limit: 10,
        offset: 5,
      });

      expect(mockedListPlans).toHaveBeenCalledWith(
        {
          userId: "user-123",
          status: "active",
          includeArchived: false,
          search: "test",
        },
        { limit: 10, offset: 5 },
      );
    });

    it("should handle partial options", async () => {
      const mockPlans = [createMockPlan()];
      mockedListPlans.mockResolvedValue(mockPlans);

      await plansService.listUserPlans("user-123", {
        status: "active",
      });

      expect(mockedListPlans).toHaveBeenCalledWith(
        {
          userId: "user-123",
          status: "active",
          includeArchived: undefined,
          search: undefined,
        },
        { limit: undefined, offset: undefined },
      );
    });

    it("should handle only limit option", async () => {
      const mockPlans = [createMockPlan()];
      mockedListPlans.mockResolvedValue(mockPlans);

      await plansService.listUserPlans("user-123", {
        limit: 20,
      });

      expect(mockedListPlans).toHaveBeenCalledWith(
        {
          userId: "user-123",
          status: undefined,
          includeArchived: undefined,
          search: undefined,
        },
        { limit: 20, offset: undefined },
      );
    });

    it("should handle only offset option", async () => {
      const mockPlans = [createMockPlan()];
      mockedListPlans.mockResolvedValue(mockPlans);

      await plansService.listUserPlans("user-123", {
        offset: 10,
      });

      expect(mockedListPlans).toHaveBeenCalledWith(
        {
          userId: "user-123",
          status: undefined,
          includeArchived: undefined,
          search: undefined,
        },
        { limit: undefined, offset: 10 },
      );
    });
  });

  describe("createUserPlan", () => {
    it("should create a new plan", async () => {
      const mockPlan = createMockPlan({
        id: "00000000-0000-0000-0000-000000000001",
        name: "New Plan",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      });

      mockedCreatePlan.mockResolvedValue(mockPlan);

      const result = await plansService.createUserPlan("user-123", {
        name: "New Plan",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      });

      expect(result).toEqual(mockPlan);
      expect(mockedCreatePlan).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "user-123",
        name: "New Plan",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      });
    });

    it("should create plan with null dates when not provided", async () => {
      const mockPlan = createMockPlan({
        id: "00000000-0000-0000-0000-000000000001",
        name: "New Plan",
      });

      mockedCreatePlan.mockResolvedValue(mockPlan);

      await plansService.createUserPlan("user-123", {
        name: "New Plan",
      });

      expect(mockedCreatePlan).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "user-123",
        name: "New Plan",
        start_date: undefined,
        end_date: undefined,
      });
    });

    it("should create plan with explicit null dates", async () => {
      const mockPlan = createMockPlan({
        id: "00000000-0000-0000-0000-000000000001",
        name: "New Plan",
        start_date: null,
        end_date: null,
      });

      mockedCreatePlan.mockResolvedValue(mockPlan);

      const result = await plansService.createUserPlan("user-123", {
        name: "New Plan",
        start_date: null,
        end_date: null,
      });

      expect(result).toEqual(mockPlan);
      expect(mockedCreatePlan).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "user-123",
        name: "New Plan",
        start_date: null,
        end_date: null,
      });
    });

    it("should create plan with only start_date", async () => {
      const mockPlan = createMockPlan({
        id: "00000000-0000-0000-0000-000000000001",
        name: "New Plan",
        start_date: "2025-01-01",
      });

      mockedCreatePlan.mockResolvedValue(mockPlan);

      const result = await plansService.createUserPlan("user-123", {
        name: "New Plan",
        start_date: "2025-01-01",
      });

      expect(result).toEqual(mockPlan);
      expect(mockedCreatePlan).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "user-123",
        name: "New Plan",
        start_date: "2025-01-01",
        end_date: undefined,
      });
    });

    it("should create plan with only end_date", async () => {
      const mockPlan = createMockPlan({
        id: "00000000-0000-0000-0000-000000000001",
        name: "New Plan",
        end_date: "2025-12-31",
      });

      mockedCreatePlan.mockResolvedValue(mockPlan);

      const result = await plansService.createUserPlan("user-123", {
        name: "New Plan",
        end_date: "2025-12-31",
      });

      expect(result).toEqual(mockPlan);
      expect(mockedCreatePlan).toHaveBeenCalledWith({
        id: "00000000-0000-0000-0000-000000000001",
        user_id: "user-123",
        name: "New Plan",
        start_date: undefined,
        end_date: "2025-12-31",
      });
    });
  });

  describe("updateUserPlan", () => {
    it("should update plan when user owns it", async () => {
      const existingPlan = createMockPlan({ name: "Old Plan" });

      const updatedPlan = {
        ...existingPlan,
        name: "Updated Plan",
      };

      mockedFindPlanById
        .mockResolvedValueOnce(existingPlan) // For ownership check
        .mockResolvedValueOnce(updatedPlan); // For returning updated plan
      mockedUpdatePlan.mockResolvedValue(1);

      const result = await plansService.updateUserPlan("user-123", "plan-1", {
        name: "Updated Plan",
      });

      expect(result).toEqual(updatedPlan);
      expect(mockedUpdatePlan).toHaveBeenCalledWith("plan-1", { name: "Updated Plan" });
    });

    it("should throw 404 when plan not found after update", async () => {
      const existingPlan = createMockPlan({ name: "Old Plan" });

      mockedFindPlanById
        .mockResolvedValueOnce(existingPlan) // For ownership check
        .mockResolvedValueOnce(undefined); // Plan not found after update
      mockedUpdatePlan.mockResolvedValue(0);

      const error = await plansService
        .updateUserPlan("user-123", "plan-1", { name: "Updated Plan" })
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });

    it("should throw 500 when updated plan cannot be retrieved", async () => {
      const existingPlan = createMockPlan({ name: "Old Plan" });

      mockedFindPlanById
        .mockResolvedValueOnce(existingPlan) // For ownership check
        .mockResolvedValueOnce(undefined); // Plan not found after update
      mockedUpdatePlan.mockResolvedValue(1); // Update succeeded but plan not found

      const error = await plansService
        .updateUserPlan("user-123", "plan-1", { name: "Updated Plan" })
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("E.PLAN.UPDATE_FAILED");
    });

    it("should handle case when update returns 0 but plan still exists", async () => {
      const existingPlan = createMockPlan({ name: "Old Plan" });
      const updatedPlan = { ...existingPlan, name: "Updated Plan" };

      mockedFindPlanById
        .mockResolvedValueOnce(existingPlan) // For ownership check
        .mockResolvedValueOnce(updatedPlan); // For returning updated plan
      mockedUpdatePlan.mockResolvedValue(0); // Update returns 0

      await expect(
        plansService.updateUserPlan("user-123", "plan-1", { name: "Updated Plan" }),
      ).rejects.toThrow("Plan not found or already archived");
    });

    it("should update plan with multiple fields", async () => {
      const existingPlan = createMockPlan({ name: "Old Plan", status: "active" });
      const updatedPlan: PlanRow = {
        ...createMockPlan(),
        name: "Updated Plan",
        status: "completed",
        end_date: "2025-12-31",
      };

      // Reset mocks to avoid interference from previous tests
      mockedFindPlanById.mockReset();
      mockedUpdatePlan.mockReset();

      // getPlanById calls findPlanById once, then updateUserPlan calls findPlanById again
      mockedFindPlanById
        .mockResolvedValueOnce(existingPlan) // First call: in getPlanById for ownership check
        .mockResolvedValueOnce(updatedPlan); // Second call: direct findPlanById to return updated plan
      mockedUpdatePlan.mockResolvedValue(1);

      const result = await plansService.updateUserPlan("user-123", "plan-1", {
        name: "Updated Plan",
        status: "completed",
        end_date: "2025-12-31",
      });

      expect(result.name).toBe("Updated Plan");
      expect(result.status).toBe("completed");
      expect(result.end_date).toBe("2025-12-31");
      expect(mockedUpdatePlan).toHaveBeenCalledWith("plan-1", {
        name: "Updated Plan",
        status: "completed",
        end_date: "2025-12-31",
      });
    });

    it("should throw 403 when user does not own plan", async () => {
      const existingPlan = createMockPlan({ user_id: "user-456" });

      // Reset mocks to avoid interference from previous tests
      mockedFindPlanById.mockReset();

      // getPlanById calls findPlanById and checks ownership
      // When plan.user_id !== userId, getPlanById should throw HttpError with code E.PLAN.FORBIDDEN
      mockedFindPlanById.mockResolvedValueOnce(existingPlan);

      const error = await plansService
        .updateUserPlan("user-123", "plan-1", { name: "Updated Plan" })
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).code).toBe("E.PLAN.FORBIDDEN");
    });
  });

  describe("archiveUserPlan", () => {
    it("should archive plan when user owns it", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedArchivePlan.mockResolvedValue(1);

      await plansService.archiveUserPlan("user-123", "plan-1");

      expect(mockedArchivePlan).toHaveBeenCalledWith("plan-1");
    });

    it("should throw 404 when plan not found or already archived", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedArchivePlan.mockResolvedValue(0);

      await expect(plansService.archiveUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.archiveUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });

    it("should throw 403 when user does not own plan", async () => {
      const existingPlan = createMockPlan({ user_id: "user-456" });

      mockedFindPlanById.mockResolvedValue(existingPlan);

      await expect(plansService.archiveUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.archiveUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.FORBIDDEN");
    });

    it("should throw 404 when plan does not exist", async () => {
      mockedFindPlanById.mockResolvedValue(undefined);

      await expect(plansService.archiveUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.archiveUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });
  });

  describe("deleteUserPlan", () => {
    it("should delete plan when user owns it", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDeletePlan.mockResolvedValue(1);

      await plansService.deleteUserPlan("user-123", "plan-1");

      expect(mockedDeletePlan).toHaveBeenCalledWith("plan-1");
    });

    it("should throw 404 when plan not found", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDeletePlan.mockResolvedValue(0);

      await expect(plansService.deleteUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.deleteUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });

    it("should throw 403 when user does not own plan", async () => {
      const existingPlan = createMockPlan({ user_id: "user-456" });

      mockedFindPlanById.mockResolvedValue(existingPlan);

      await expect(plansService.deleteUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.deleteUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.FORBIDDEN");
    });

    it("should throw 404 when plan does not exist", async () => {
      mockedFindPlanById.mockResolvedValue(undefined);

      await expect(plansService.deleteUserPlan("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.deleteUserPlan("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });
  });

  describe("recomputeProgress", () => {
    let mockQueryBuilder: {
      where: jest.Mock;
      whereNull: jest.Mock;
      select: jest.Mock;
      first: jest.Mock;
    };

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn(),
      };
      mockedDb.mockReturnValue(mockQueryBuilder as never);
      mockedDb.raw = jest.fn((sql: string) => sql);
    });

    it("should recompute progress for a plan", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockQueryBuilder.first.mockResolvedValue({
        total: "10",
        completed: "7",
      });
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedDb).toHaveBeenCalledWith("sessions");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ plan_id: "plan-1" });
      expect(mockQueryBuilder.whereNull).toHaveBeenCalledWith("deleted_at");
      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 10, 7, undefined);
      expect(mockedDb.raw).toHaveBeenCalled();
    });

    it("should work with transaction", async () => {
      const mockTrxQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total: "5",
          completed: "3",
        }),
      };
      const mockTrx = jest.fn(() => mockTrxQueryBuilder) as never;
      (mockTrx as { raw: jest.Mock }).raw = jest.fn((sql: string) => sql);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1", mockTrx);

      expect(mockedFindPlanById).not.toHaveBeenCalled();
      expect(mockTrx).toHaveBeenCalledWith("sessions");
      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 5, 3, mockTrx);
    });

    it("should handle zero sessions", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockQueryBuilder.first.mockResolvedValue({
        total: "0",
        completed: "0",
      });
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 0, 0, undefined);
    });

    it("should handle null session stats", async () => {
      const existingPlan = createMockPlan();

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockQueryBuilder.first.mockResolvedValue(null);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 0, 0, undefined);
    });

    it("should handle missing total in session stats", async () => {
      const existingPlan = createMockPlan();
      const customQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          completed: "3",
        }),
      };

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDb.mockReturnValue(customQueryBuilder as never);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 0, 3, undefined);
    });

    it("should handle missing completed in session stats", async () => {
      const existingPlan = createMockPlan();
      const customQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total: "5",
        }),
      };

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDb.mockReturnValue(customQueryBuilder as never);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 5, 0, undefined);
    });

    it("should handle empty string values in session stats", async () => {
      const existingPlan = createMockPlan();
      const customQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total: undefined, // Use undefined to trigger fallback to "0"
          completed: undefined,
        }),
      };

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDb.mockReturnValue(customQueryBuilder as never);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 0, 0, undefined);
    });

    it("should handle large session counts", async () => {
      const existingPlan = createMockPlan();
      const customQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          total: "1000",
          completed: "750",
        }),
      };

      mockedFindPlanById.mockResolvedValue(existingPlan);
      mockedDb.mockReturnValue(customQueryBuilder as never);
      mockedUpdatePlanProgress.mockResolvedValue(1);

      await plansService.recomputeProgress("user-123", "plan-1");

      expect(mockedUpdatePlanProgress).toHaveBeenCalledWith("plan-1", 1000, 750, undefined);
    });

    it("should throw 403 when user does not own plan", async () => {
      const existingPlan = createMockPlan({ user_id: "user-456" });
      mockedFindPlanById.mockResolvedValue(existingPlan);

      await expect(plansService.recomputeProgress("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.recomputeProgress("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.FORBIDDEN");
    });

    it("should throw 404 when plan does not exist", async () => {
      mockedFindPlanById.mockResolvedValue(undefined);

      await expect(plansService.recomputeProgress("user-123", "plan-1")).rejects.toThrow(HttpError);
      const error = await plansService.recomputeProgress("user-123", "plan-1").catch((e) => e);
      expect((error as HttpError).code).toBe("E.PLAN.NOT_FOUND");
    });
  });

  describe("getUserPlanStats", () => {
    it("should return plan statistics for user", async () => {
      mockedCountUserPlans
        .mockResolvedValueOnce(10) // total (includeArchived: true)
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(3) // completed
        .mockResolvedValueOnce(10) // total for archived calculation
        .mockResolvedValueOnce(8); // non-archived

      const result = await plansService.getUserPlanStats("user-123");

      expect(result).toEqual({
        total: 10,
        active: 5,
        completed: 3,
        archived: 2, // 10 - 8
      });
    });

    it("should handle archived calculation error gracefully", async () => {
      mockedCountUserPlans
        .mockResolvedValueOnce(10) // total (includeArchived: true)
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(3) // completed
        .mockResolvedValueOnce(10) // total for archived calculation
        .mockRejectedValueOnce(new Error("Database error")); // non-archived fails

      const result = await plansService.getUserPlanStats("user-123");

      expect(result).toEqual({
        total: 10,
        active: 5,
        completed: 3,
        archived: 0, // Falls back to 0 on error
      });
    });

    it("should handle zero counts", async () => {
      mockedCountUserPlans
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // active
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(0) // total for archived
        .mockResolvedValueOnce(0); // non-archived

      const result = await plansService.getUserPlanStats("user-123");

      expect(result).toEqual({
        total: 0,
        active: 0,
        completed: 0,
        archived: 0,
      });
    });

    it("should handle case where all plans are archived", async () => {
      mockedCountUserPlans
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(0) // active
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(10) // total for archived
        .mockResolvedValueOnce(0); // non-archived

      const result = await plansService.getUserPlanStats("user-123");

      expect(result).toEqual({
        total: 10,
        active: 0,
        completed: 0,
        archived: 10,
      });
    });

    it("should handle case where no plans are archived", async () => {
      mockedCountUserPlans
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(5) // completed
        .mockResolvedValueOnce(10) // total for archived
        .mockResolvedValueOnce(10); // non-archived

      const result = await plansService.getUserPlanStats("user-123");

      expect(result).toEqual({
        total: 10,
        active: 5,
        completed: 5,
        archived: 0,
      });
    });

    it("should handle error in first countUserPlans call", async () => {
      mockedCountUserPlans.mockRejectedValue(new Error("Database error"));

      await expect(plansService.getUserPlanStats("user-123")).rejects.toThrow("Database error");
    });
  });
});
