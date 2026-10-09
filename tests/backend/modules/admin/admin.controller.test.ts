import type { Request, Response } from "express";
import {
  listReportsHandler,
  moderateReportHandler,
  searchUsersHandler,
  userActionHandler,
} from "../../../../apps/backend/src/modules/admin/admin.controller.js";
import * as adminService from "../../../../apps/backend/src/modules/admin/admin.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

// Mock admin service
jest.mock("../../../../apps/backend/src/modules/admin/admin.service.js");

const mockAdminService = jest.mocked(adminService);

describe("Admin Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const userId = "admin-123";

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: {
        sub: userId,
        role: "admin",
        username: "admin",
      },
      query: {},
      params: {},
      body: {},
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe("listReportsHandler", () => {
    it("should list reports with default parameters", async () => {
      const mockReports = [{ id: "report-1", status: "pending" }];
      mockAdminService.listReports.mockResolvedValue(mockReports);

      await listReportsHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.listReports).toHaveBeenCalledWith({
        status: "pending",
        limit: 50,
        offset: 0,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({ reports: mockReports });
    });

    it("should list reports with custom status", async () => {
      const mockReports = [{ id: "report-1", status: "reviewed" }];
      mockRequest.query = { status: "reviewed" };
      mockAdminService.listReports.mockResolvedValue(mockReports);

      await listReportsHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.listReports).toHaveBeenCalledWith({
        status: "reviewed",
        limit: 50,
        offset: 0,
      });
    });

    it("should list reports with custom limit and offset", async () => {
      const mockReports = [{ id: "report-1" }];
      mockRequest.query = { limit: "25", offset: "10" };
      mockAdminService.listReports.mockResolvedValue(mockReports);

      await listReportsHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.listReports).toHaveBeenCalledWith({
        status: "pending",
        limit: 25,
        offset: 10,
      });
    });

    it("should cap limit at 100", async () => {
      const mockReports = [{ id: "report-1" }];
      mockRequest.query = { limit: "200" };
      mockAdminService.listReports.mockResolvedValue(mockReports);

      await listReportsHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.listReports).toHaveBeenCalledWith({
        status: "pending",
        limit: 100,
        offset: 0,
      });
    });
  });

  describe("moderateReportHandler", () => {
    it("should moderate report with dismiss action", async () => {
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = { action: "dismiss" };
      mockAdminService.moderateReport.mockResolvedValue(undefined);

      await moderateReportHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.moderateReport).toHaveBeenCalledWith({
        reportId: "report-123",
        action: "dismiss",
        adminId: userId,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Report dismissed successfully",
      });
    });

    it("should moderate report with hide action", async () => {
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = { action: "hide" };
      mockAdminService.moderateReport.mockResolvedValue(undefined);

      await moderateReportHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.moderateReport).toHaveBeenCalledWith({
        reportId: "report-123",
        action: "hide",
        adminId: userId,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Report hidden successfully",
      });
    });

    it("should moderate report with ban action", async () => {
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = { action: "ban" };
      mockAdminService.moderateReport.mockResolvedValue(undefined);

      await moderateReportHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.moderateReport).toHaveBeenCalledWith({
        reportId: "report-123",
        action: "ban",
        adminId: userId,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Report banned successfully",
      });
    });

    it("should throw 401 when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = { action: "dismiss" };

      await expect(
        moderateReportHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);

      const error = await moderateReportHandler(
        mockRequest as Request,
        mockResponse as Response,
      ).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
      expect(mockAdminService.moderateReport).not.toHaveBeenCalled();
    });

    it("should throw 400 for invalid action", async () => {
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = { action: "invalid" };

      await expect(
        moderateReportHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);

      const error = await moderateReportHandler(
        mockRequest as Request,
        mockResponse as Response,
      ).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).code).toBe("INVALID_ACTION");
    });

    it("should throw 400 when action is missing", async () => {
      mockRequest.params = { reportId: "report-123" };
      mockRequest.body = {};

      await expect(
        moderateReportHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);

      const error = await moderateReportHandler(
        mockRequest as Request,
        mockResponse as Response,
      ).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    });
  });

  describe("searchUsersHandler", () => {
    it("should search users with query", async () => {
      const mockUsers = [{ id: "user-1", username: "testuser" }];
      mockRequest.query = { q: "test" };
      mockAdminService.searchUsersService.mockResolvedValue(mockUsers);

      await searchUsersHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.searchUsersService).toHaveBeenCalledWith({
        query: "test",
        limit: 20,
        offset: 0,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({ users: mockUsers });
    });

    it("should search users with custom limit and offset", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockRequest.query = { q: "test", limit: "30", offset: "5" };
      mockAdminService.searchUsersService.mockResolvedValue(mockUsers);

      await searchUsersHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.searchUsersService).toHaveBeenCalledWith({
        query: "test",
        limit: 30,
        offset: 5,
      });
    });

    it("should cap limit at 50", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockRequest.query = { q: "test", limit: "100" };
      mockAdminService.searchUsersService.mockResolvedValue(mockUsers);

      await searchUsersHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.searchUsersService).toHaveBeenCalledWith({
        query: "test",
        limit: 50,
        offset: 0,
      });
    });

    it("lists users when query is missing", async () => {
      const mockUsers = [{ id: "user-1" }];
      mockRequest.query = {};
      mockAdminService.searchUsersService.mockResolvedValue(mockUsers);

      await searchUsersHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.searchUsersService).toHaveBeenCalledWith({
        query: "",
        limit: 20,
        offset: 0,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({ users: mockUsers });
    });
  });

  describe("userActionHandler", () => {
    it("should perform suspend action", async () => {
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "suspend", reason: "Violation" };
      mockAdminService.performUserAction.mockResolvedValue(undefined);

      await userActionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.performUserAction).toHaveBeenCalledWith({
        userId: "user-123",
        action: "suspend",
        adminId: userId,
        reason: "Violation",
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "User suspended successfully",
      });
    });

    it("should perform ban action", async () => {
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "ban" };
      mockAdminService.performUserAction.mockResolvedValue(undefined);

      await userActionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.performUserAction).toHaveBeenCalledWith({
        userId: "user-123",
        action: "ban",
        adminId: userId,
        reason: undefined,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "User banned successfully",
      });
    });

    it("should perform activate action", async () => {
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "activate" };
      mockAdminService.performUserAction.mockResolvedValue(undefined);

      await userActionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.performUserAction).toHaveBeenCalledWith({
        userId: "user-123",
        action: "activate",
        adminId: userId,
        reason: undefined,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "User activated successfully",
      });
    });

    it("should perform delete action", async () => {
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "delete" };
      mockAdminService.performUserAction.mockResolvedValue(undefined);

      await userActionHandler(mockRequest as Request, mockResponse as Response);

      expect(mockAdminService.performUserAction).toHaveBeenCalledWith({
        userId: "user-123",
        action: "delete",
        adminId: userId,
        reason: undefined,
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "User deleted successfully",
      });
    });

    it("should throw 401 when user is not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "suspend" };

      await expect(
        userActionHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);

      const error = await userActionHandler(mockRequest as Request, mockResponse as Response).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
      expect(mockAdminService.performUserAction).not.toHaveBeenCalled();
    });

    it("should throw 400 for invalid action", async () => {
      mockRequest.params = { userId: "user-123" };
      mockRequest.body = { action: "invalid" };

      await expect(
        userActionHandler(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow(HttpError);

      const error = await userActionHandler(mockRequest as Request, mockResponse as Response).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
      expect((error as HttpError).code).toBe("INVALID_ACTION");
    });
  });
});
