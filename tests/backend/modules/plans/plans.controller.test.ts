import type { Request, Response } from "express";
import * as plansController from "../../../../apps/backend/src/modules/plans/plans.controller.js";
import * as plansService from "../../../../apps/backend/src/modules/plans/plans.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/plans/plans.service.js");

const mockPlansService = jest.mocked(plansService);

describe("Plans Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "user-123";
  const planId = "plan-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { sub: userId, role: "athlete" },
      body: {},
      query: {},
      params: {},
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("listPlansHandler", () => {
    it("should list plans successfully", async () => {
      const mockPlans = [];

      mockPlansService.listUserPlans.mockResolvedValue(mockPlans);

      await plansController.listPlansHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ plans: mockPlans });
    });

    it("should handle query parameters", async () => {
      const mockPlans = [];
      mockRequest.query = {
        status: "active",
        includeArchived: "true",
        search: "test",
        limit: "10",
        offset: "0",
      };

      mockPlansService.listUserPlans.mockResolvedValue(mockPlans);

      await plansController.listPlansHandler(mockRequest as Request, mockResponse as Response);

      expect(mockPlansService.listUserPlans).toHaveBeenCalledWith(userId, {
        status: "active",
        includeArchived: true,
        search: "test",
        limit: 10,
        offset: 0,
      });
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;

      await expect(
        plansController.listPlansHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should reject invalid status filter", async () => {
      mockRequest.query = { status: "archived" };

      await expect(
        plansController.listPlansHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toMatchObject({
        code: "E.PLAN.INVALID_STATUS",
        status: 400,
      });
      expect(mockPlansService.listUserPlans).not.toHaveBeenCalled();
    });
  });

  describe("getPlanStatsHandler", () => {
    it("should get plan stats successfully", async () => {
      const mockStats = {
        total: 5,
        active: 3,
        completed: 1,
        archived: 1,
      };

      mockPlansService.getUserPlanStats.mockResolvedValue(mockStats as never);

      await plansController.getPlanStatsHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;

      await expect(
        plansController.getPlanStatsHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("getPlanHandler", () => {
    it("should get plan successfully", async () => {
      const mockPlan = {
        id: planId,
        user_id: userId,
        name: "Test Plan",
        status: "active",
      };

      mockRequest.params = { id: planId };
      mockPlansService.getPlanById.mockResolvedValue(mockPlan as never);

      await plansController.getPlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(mockPlan);
      expect(mockResponse.setHeader).toHaveBeenCalledWith("ETag", expect.any(String));
    });

    it("should throw 400 when plan ID is missing", async () => {
      mockRequest.params = {};

      await expect(
        plansController.getPlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: planId };

      await expect(
        plansController.getPlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("createPlanHandler", () => {
    it("should create plan successfully", async () => {
      const planData = {
        name: "Test Plan",
      };

      const mockPlan = {
        id: planId,
        user_id: userId,
        ...planData,
        status: "active",
      };

      mockRequest.body = planData;
      mockPlansService.createUserPlan.mockResolvedValue(mockPlan as never);

      await plansController.createPlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockPlan);
    });

    it("should create plan with optional dates", async () => {
      const planData = {
        name: "Test Plan",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      };

      const mockPlan = {
        id: planId,
        user_id: userId,
        ...planData,
        status: "active",
      };

      mockRequest.body = planData;
      mockPlansService.createUserPlan.mockResolvedValue(mockPlan as never);

      await plansController.createPlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockPlan);
    });

    it("should throw error when validation fails", async () => {
      mockRequest.body = { name: "" }; // Invalid: empty name

      await expect(
        plansController.createPlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.body = { name: "Test Plan" };

      await expect(
        plansController.createPlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("updatePlanHandler", () => {
    it("should update plan successfully", async () => {
      const updateData = {
        name: "Updated Plan",
        status: "completed" as const,
      };

      const mockPlan = {
        id: planId,
        user_id: userId,
        ...updateData,
      };

      mockRequest.params = { id: planId };
      mockRequest.body = updateData;
      mockPlansService.updateUserPlan.mockResolvedValue(mockPlan as never);

      await plansController.updatePlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(mockPlan);
    });

    it("should throw 400 when plan ID is missing", async () => {
      mockRequest.params = {};
      mockRequest.body = { name: "Updated Plan" };

      await expect(
        plansController.updatePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when validation fails", async () => {
      mockRequest.params = { id: planId };
      mockRequest.body = { name: "" }; // Invalid: empty name

      await expect(
        plansController.updatePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: planId };
      mockRequest.body = { name: "Updated Plan" };

      await expect(
        plansController.updatePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });

    it("should pass If-Match to the service and return the new validator", async () => {
      mockRequest.params = { id: planId };
      mockRequest.body = { name: "Changed" };
      mockRequest.headers = { "if-match": '"plan-plan-123-1"' };
      mockPlansService.updateUserPlan.mockResolvedValue({
        id: planId, revision: 2, name: "Changed",
      } as never);
      await plansController.updatePlanHandler(mockRequest as Request, mockResponse as Response);
      expect(mockPlansService.updateUserPlan).toHaveBeenCalledWith(
        userId, planId, { name: "Changed" }, '"plan-plan-123-1"',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith("ETag", '"plan-plan-123-2"');
    });

  describe("archivePlanHandler", () => {
    it("should archive plan successfully", async () => {
      mockRequest.params = { id: planId };
      mockPlansService.archiveUserPlan.mockResolvedValue(undefined);

      await plansController.archivePlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockPlansService.archiveUserPlan).toHaveBeenCalledWith(userId, planId);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should throw 400 when plan ID is missing", async () => {
      mockRequest.params = {};

      await expect(
        plansController.archivePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: planId };

      await expect(
        plansController.archivePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });

  describe("deletePlanHandler", () => {
    it("should delete plan successfully", async () => {
      mockRequest.params = { id: planId };
      mockPlansService.deleteUserPlan.mockResolvedValue(undefined);

      await plansController.deletePlanHandler(mockRequest as Request, mockResponse as Response);

      expect(mockPlansService.deleteUserPlan).toHaveBeenCalledWith(userId, planId);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should throw 400 when plan ID is missing", async () => {
      mockRequest.params = {};

      await expect(
        plansController.deletePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { id: planId };

      await expect(
        plansController.deletePlanHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);
    });
  });
});
