import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listReports,
  moderateReport,
  searchUsers,
  performUserAction,
  listAuditLogs,
  getRecentActivity,
  type FeedReport,
} from "../../src/services/adminApi";
import { apiClient } from "../../src/services/httpApi";

vi.mock("../../src/services/httpApi", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("adminApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listReports", () => {
    it("should fetch reports with default params", async () => {
      const mockReports = [
        {
          id: "report-1",
          reporterUsername: "user1",
          feedItemId: "feed-1",
          reason: "spam",
          status: "pending",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { reports: mockReports },
      });

      const result = await listReports();

      expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/reports",
        { params: undefined },
      );
      expect(result).toEqual(mockReports);
    });

    it("should fetch reports with filters", async () => {
      const mockReports: FeedReport[] = [];
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { reports: mockReports },
      });

      await listReports({ status: "pending", limit: 10, offset: 0 });

      expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/reports",
        {
          params: { status: "pending", limit: 10, offset: 0 },
        },
      );
    });
  });

  describe("moderateReport", () => {
    it("should moderate a report", async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

      await moderateReport("report-1", "dismiss");

      expect(apiClient.post as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/reports/report-1/moderate",
        {
          action: "dismiss",
        },
      );
    });
  });

  describe("searchUsers", () => {
    it("should search users", async () => {
      const mockUsers = [
        {
          id: "user-1",
          username: "testuser",
          email: "test@example.com",
          roleCode: "user",
          status: "active",
          createdAt: "2024-01-01T00:00:00Z",
          lastLoginAt: null,
          sessionCount: 5,
          reportCount: 0,
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { users: mockUsers },
      });

      const result = await searchUsers("test", { limit: 10, offset: 0 });

      expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/users/search",
        {
          params: { q: "test", limit: 10, offset: 0 },
        },
      );
      expect(result).toEqual(mockUsers);
    });
  });

  describe("performUserAction", () => {
    it("should perform user action", async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

      await performUserAction("user-1", "suspend", "Violation of terms");

      expect(apiClient.post as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/users/user-1/action",
        {
          action: "suspend",
          reason: "Violation of terms",
        },
      );
    });

    it("should perform user action without reason", async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

      await performUserAction("user-1", "activate");

      expect(apiClient.post as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/admin/users/user-1/action",
        {
          action: "activate",
          reason: undefined,
        },
      );
    });
  });

  describe("listAuditLogs", () => {
    it("should list audit logs", async () => {
      const mockLogs = [
        {
          id: "log-1",
          actorUserId: "user-1",
          actorUsername: "admin",
          entityType: "user",
          action: "suspend",
          entityId: "user-2",
          outcome: "success",
          requestId: "req-1",
          metadata: {},
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { logs: mockLogs },
      });

      const result = await listAuditLogs({ action: "suspend", limit: 10 });

      expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith("/api/v1/logs", {
        params: { action: "suspend", limit: 10 },
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe("getRecentActivity", () => {
    it("should get recent activity", async () => {
      const mockActivity = [
        {
          id: "log-1",
          actorUserId: "user-1",
          actorUsername: "admin",
          entityType: "user",
          action: "create",
          entityId: "user-2",
          outcome: "success",
          requestId: null,
          metadata: {},
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { activity: mockActivity },
      });

      const result = await getRecentActivity(5);

      expect(apiClient.get as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        "/api/v1/logs/recent-activity",
        {
          params: { limit: 5 },
        },
      );
      expect(result).toEqual(mockActivity);
    });
  });
});
