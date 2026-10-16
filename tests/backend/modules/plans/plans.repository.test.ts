import { db } from "../../../../apps/backend/src/db/connection.js";
import * as plansRepository from "../../../../apps/backend/src/modules/plans/plans.repository.js";
import type { Plan } from "../../../../apps/backend/src/modules/plans/plans.types.js";

// Mock db
const queryBuilders: Record<string, any> = {};

function createMockQueryBuilder(defaultValue: unknown = null) {
  const builder = Object.assign(Promise.resolve(defaultValue), {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockReturnThis(),
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
    transaction: jest.Mock;
  };

  mockDbFunction.transaction = jest.fn((callback) => callback(mockDbFunction));
  (mockDbFunction as any).raw = jest.fn((expression: string) => expression);

  return {
    db: mockDbFunction,
  };
});

describe("Plans Repository", () => {
  const userId = "user-123";
  const planId = "plan-123";

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(queryBuilders).forEach((key) => delete queryBuilders[key]);
  });

  describe("findPlanById", () => {
    it("should find plan by id", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "Test Plan",
        status: "active",
        progress_percent: 0,
        session_count: 0,
        completed_count: 0,
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("plans");
      if (queryBuilders["plans"]) {
        queryBuilders["plans"].first.mockResolvedValue(mockPlan);
      }

      const result = await plansRepository.findPlanById(planId);

      expect(result).toEqual(mockPlan);
      expect(queryBuilders["plans"]?.where).toHaveBeenCalledWith({ id: planId });
      expect(queryBuilders["plans"]?.whereNull).toHaveBeenCalledWith("archived_at");
    });

    it("should find plan by id including archived", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "Archived Plan",
        status: "completed",
        progress_percent: 100,
        session_count: 10,
        completed_count: 10,
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: new Date().toISOString(),
      };

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("plans");
      if (queryBuilders["plans"]) {
        queryBuilders["plans"].first.mockResolvedValue(mockPlan);
      }

      const result = await plansRepository.findPlanById(planId, { includeArchived: true });

      expect(result).toEqual(mockPlan);
      expect(queryBuilders["plans"]?.where).toHaveBeenCalledWith({ id: planId });
      expect(queryBuilders["plans"]?.whereNull).not.toHaveBeenCalled();
    });

    it("should return undefined when plan not found", async () => {
      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      dbFn("plans");
      if (queryBuilders["plans"]) {
        queryBuilders["plans"].first.mockResolvedValue(undefined);
      }

      const result = await plansRepository.findPlanById(planId);

      expect(result).toBeUndefined();
    });
  });

  describe("listPlans", () => {
    it("should list plans", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];

      const dbModule = await import("../../../../apps/backend/src/db/connection.js");
      const dbFn = dbModule.db as jest.Mock;
      // Create a new builder with mockPlans as the default value
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;
      dbFn("plans");

      const result = await plansRepository.listPlans({ userId });

      expect(result).toEqual(mockPlans);
      expect(queryBuilders["plans"]?.where).toHaveBeenCalledWith({ user_id: userId });
      expect(queryBuilders["plans"]?.whereNull).toHaveBeenCalledWith("archived_at");
      expect(queryBuilders["plans"]?.orderBy).toHaveBeenCalledWith("created_at", "desc");
    });

    it("should filter by status", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;

      await plansRepository.listPlans({ userId, status: "active" });

      expect(queryBuilders["plans"]?.where).toHaveBeenCalledWith({ user_id: userId });
      expect(queryBuilders["plans"]?.where).toHaveBeenCalledWith({ status: "active" });
    });

    it("should include archived plans when requested", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;

      await plansRepository.listPlans({ userId, includeArchived: true });

      expect(queryBuilders["plans"]?.whereNull).not.toHaveBeenCalled();
    });

    it("should filter by search term", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;

      await plansRepository.listPlans({ userId, search: "test" });

      expect(queryBuilders["plans"]?.whereRaw).toHaveBeenCalledWith("LOWER(name) LIKE ?", [
        "%test%",
      ]);
    });

    it("should apply pagination", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;

      await plansRepository.listPlans({ userId }, { limit: 10, offset: 20 });

      expect(queryBuilders["plans"]?.limit).toHaveBeenCalledWith(10);
      expect(queryBuilders["plans"]?.offset).toHaveBeenCalledWith(20);
    });

    it("should work without filters", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      queryBuilders["plans"] = newBuilder;

      await plansRepository.listPlans();

      expect(queryBuilders["plans"]?.orderBy).toHaveBeenCalledWith("created_at", "desc");
    });

    it("should work with transaction", async () => {
      const mockPlans: plansRepository.PlanRow[] = [];
      const newBuilder = createMockQueryBuilder(mockPlans);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.listPlans({ userId }, undefined, mockTrx);

      expect(newBuilder.where).toHaveBeenCalled();
    });
  });

  describe("createPlan", () => {
    it("should create a new plan", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        status: "active",
        progress_percent: 0,
        session_count: 0,
        completed_count: 0,
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockPlan]);

      const input: plansRepository.CreatePlanInput = {
        id: planId,
        user_id: userId,
        name: "New Plan",
      };

      const result = await plansRepository.createPlan(input);

      expect(result).toEqual(mockPlan);
      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: planId,
          user_id: userId,
          name: "New Plan",
          status: "active",
          progress_percent: 0,
          session_count: 0,
          completed_count: 0,
        }),
      );
    });

    it("should create plan with custom status", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        status: "completed",
        progress_percent: 0,
        session_count: 0,
        completed_count: 0,
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockPlan]);

      const input: plansRepository.CreatePlanInput = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        status: "completed",
      };

      await plansRepository.createPlan(input);

      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        }),
      );
    });

    it("should create plan with dates", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        status: "active",
        progress_percent: 0,
        session_count: 0,
        completed_count: 0,
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.returning.mockResolvedValue([mockPlan]);

      const input: plansRepository.CreatePlanInput = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      };

      await plansRepository.createPlan(input);

      expect(newBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: "2025-01-01",
          end_date: "2025-12-31",
        }),
      );
    });

    it("should work with transaction", async () => {
      const mockPlan: plansRepository.PlanRow = {
        id: planId,
        user_id: userId,
        name: "New Plan",
        status: "active",
        progress_percent: 0,
        session_count: 0,
        completed_count: 0,
        start_date: null,
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      const newBuilder = createMockQueryBuilder();
      newBuilder.returning.mockResolvedValue([mockPlan]);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.createPlan({ id: planId, user_id: userId, name: "New Plan" }, mockTrx);

      expect(newBuilder.insert).toHaveBeenCalled();
    });
  });

  describe("updatePlan", () => {
    it("should update plan", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const updates: plansRepository.UpdatePlanInput = {
        name: "Updated Plan",
        status: "completed",
      };

      const result = await plansRepository.updatePlan(planId, updates);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({ id: planId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("archived_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Plan",
          status: "completed",
          updated_at: expect.any(String),
        }),
      );
    });

    it("should update plan progress metrics", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const updates: plansRepository.UpdatePlanInput = {
        progress_percent: 75,
        session_count: 10,
        completed_count: 7,
      };

      await plansRepository.updatePlan(planId, updates);

      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress_percent: 75,
          session_count: 10,
          completed_count: 7,
        }),
      );
    });

    it("should update plan dates", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const updates: plansRepository.UpdatePlanInput = {
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      };

      await plansRepository.updatePlan(planId, updates);

      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: "2025-01-01",
          end_date: "2025-12-31",
        }),
      );
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.updatePlan(planId, { name: "Updated" }, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("archivePlan", () => {
    it("should archive a plan", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const result = await plansRepository.archivePlan(planId);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({ id: planId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("archived_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      );
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.archivePlan(planId, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
    });
  });

  describe("deletePlan", () => {
    it("should soft-delete a plan", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const result = await plansRepository.deletePlan(planId);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({ id: planId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("archived_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          archived_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      );
      expect(newBuilder.del).not.toHaveBeenCalled();
    });

    it("should soft-delete with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.deletePlan(planId, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
      expect(newBuilder.del).not.toHaveBeenCalled();
    });
  });

  describe("countUserPlans", () => {
    it("should count user plans", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: "5" });

      const result = await plansRepository.countUserPlans(userId);

      expect(result).toBe(5);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("archived_at");
      expect(newBuilder.count).toHaveBeenCalledWith("* as count");
    });

    it("should count user plans with status filter", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: "3" });

      const result = await plansRepository.countUserPlans(userId, { status: "active" });

      expect(result).toBe(3);
      expect(newBuilder.where).toHaveBeenCalledWith({ user_id: userId });
      expect(newBuilder.where).toHaveBeenCalledWith({ status: "active" });
    });

    it("should count user plans including archived", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.first.mockResolvedValue({ count: "10" });

      const result = await plansRepository.countUserPlans(userId, { includeArchived: true });

      expect(result).toBe(10);
      expect(newBuilder.whereNull).not.toHaveBeenCalled();
    });

    it("should handle null count result", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.first.mockResolvedValue(null);

      const result = await plansRepository.countUserPlans(userId);

      expect(result).toBe(0);
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.first.mockResolvedValue({ count: "2" });
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.countUserPlans(userId, undefined, mockTrx);

      expect(newBuilder.count).toHaveBeenCalled();
    });
  });

  describe("updatePlanProgress", () => {
    it("should update plan progress", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      const result = await plansRepository.updatePlanProgress(planId, 10, 7);

      expect(result).toBe(1);
      expect(newBuilder.where).toHaveBeenCalledWith({ id: planId });
      expect(newBuilder.whereNull).toHaveBeenCalledWith("archived_at");
      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          session_count: 10,
          completed_count: 7,
          progress_percent: 70,
          updated_at: expect.any(String),
        }),
      );
    });

    it("should calculate progress percent correctly", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await plansRepository.updatePlanProgress(planId, 3, 2);

      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress_percent: expect.closeTo(66.67, 2),
        }),
      );
    });

    it("should handle zero sessions", async () => {
      const newBuilder = createMockQueryBuilder();
      queryBuilders["plans"] = newBuilder;
      newBuilder.update.mockResolvedValue(1);

      await plansRepository.updatePlanProgress(planId, 0, 0);

      expect(newBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          progress_percent: 0,
        }),
      );
    });

    it("should work with transaction", async () => {
      const newBuilder = createMockQueryBuilder();
      newBuilder.update.mockResolvedValue(1);
      const mockTrx = ((_table: string) => newBuilder) as any;

      await plansRepository.updatePlanProgress(planId, 5, 3, mockTrx);

      expect(newBuilder.update).toHaveBeenCalled();
    });
  });
});
