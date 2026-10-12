import * as adminService from "../../../../apps/backend/src/modules/admin/admin.service.js";
import * as adminRepository from "../../../../apps/backend/src/modules/admin/admin.repository.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";
import type {
  FeedReport,
  ModerateReportInput,
  UserSearchResult,
  UserActionInput,
  ListReportsQuery,
  SearchUsersQuery,
} from "../../../../apps/backend/src/modules/admin/admin.types.js";

// Mock dependencies
jest.mock("../../../../apps/backend/src/modules/admin/admin.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockAdminRepo = jest.mocked(adminRepository);

describe("Admin Service", () => {
  const adminId = "admin-123";
  const reportId = "report-123";
  const feedItemId = "feed-item-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listReports", () => {
    it("should return list of reports", async () => {
      const query: ListReportsQuery = {
        status: "pending",
        limit: 10,
      };

      const mockReports: FeedReport[] = [
        {
          id: reportId,
          feedItemId,
          reason: "spam",
          status: "pending",
          reportedAt: new Date().toISOString(),
          contentAuthor: "testuser",
        },
      ];

      mockAdminRepo.listFeedReports.mockResolvedValue(mockReports);

      const result = await adminService.listReports(query);

      expect(result).toEqual(mockReports);
      expect(mockAdminRepo.listFeedReports).toHaveBeenCalledWith(query);
    });
  });

  describe("moderateReport", () => {
    const mockReport: FeedReport = {
      id: reportId,
      feedItemId,
      reason: "spam",
      status: "pending",
      reportedAt: new Date().toISOString(),
      contentAuthor: "testuser",
    };

    it("should dismiss a report", async () => {
      const input: ModerateReportInput = {
        reportId,
        action: "dismiss",
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(mockReport);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "dismissed", adminId);
    });

    it("should hide feed item when action is hide", async () => {
      const input: ModerateReportInput = {
        reportId,
        action: "hide",
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(mockReport);
      mockAdminRepo.hideFeedItem.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.hideFeedItem).toHaveBeenCalledWith(feedItemId);
      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "reviewed", adminId);
    });

    it("should hide comment when action is hide and report has commentId", async () => {
      const commentId = "comment-123";
      const commentReport: FeedReport = {
        id: reportId,
        commentId,
        reason: "spam",
        status: "pending",
        reportedAt: new Date().toISOString(),
        contentAuthor: "testuser",
      };

      const input: ModerateReportInput = {
        reportId,
        action: "hide",
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(commentReport);
      mockAdminRepo.hideComment.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.hideComment).toHaveBeenCalledWith(commentId);
      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "reviewed", adminId);
    });

    it("should ban user and hide content when action is ban", async () => {
      const input: ModerateReportInput = {
        reportId,
        action: "ban",
        adminId,
      };

      const mockFeedItem = {
        ...mockReport,
        contentAuthor: "testuser",
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(mockFeedItem);
      mockAdminRepo.searchUsers.mockResolvedValue([
        {
          id: "user-123",
          username: "testuser",
          displayName: "Test User",
          email: "test@example.com",
          status: "active",
          role: "athlete",
        },
      ]);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);
      mockAdminRepo.hideFeedItem.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.searchUsers).toHaveBeenCalledWith({ query: "testuser", limit: 1 });
      expect(mockAdminRepo.updateUserStatus).toHaveBeenCalledWith("user-123", "banned");
      expect(mockAdminRepo.hideFeedItem).toHaveBeenCalledWith(feedItemId);
      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "reviewed", adminId);
    });

    it("should ban user and hide comment when action is ban and report has commentId", async () => {
      const commentId = "comment-123";
      const commentReport: FeedReport = {
        id: reportId,
        commentId,
        reason: "spam",
        status: "pending",
        reportedAt: new Date().toISOString(),
        contentAuthor: "testuser",
      };

      const input: ModerateReportInput = {
        reportId,
        action: "ban",
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(commentReport);
      mockAdminRepo.searchUsers.mockResolvedValue([
        {
          id: "user-123",
          username: "testuser",
          displayName: "Test User",
          email: "test@example.com",
          status: "active",
          role: "athlete",
        },
      ]);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);
      mockAdminRepo.hideComment.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.hideComment).toHaveBeenCalledWith(commentId);
      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "reviewed", adminId);
    });

    it("should throw error for invalid moderation action", async () => {
      const input: ModerateReportInput = {
        reportId,
        action: "invalid" as never,
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(mockReport);

      await expect(adminService.moderateReport(input)).rejects.toThrow(HttpError);
      await expect(adminService.moderateReport(input)).rejects.toThrow("Invalid moderation action");
    });

    it("should throw 404 when report not found", async () => {
      mockAdminRepo.getFeedReportById.mockResolvedValue(null);

      await expect(
        adminService.moderateReport({ reportId, action: "dismiss", adminId }),
      ).rejects.toThrow(HttpError);
    });

    it("should throw error when report already resolved", async () => {
      const resolvedReport: FeedReport = {
        ...mockReport,
        status: "dismissed",
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(resolvedReport);

      await expect(
        adminService.moderateReport({ reportId, action: "dismiss", adminId }),
      ).rejects.toThrow(HttpError);
      await expect(
        adminService.moderateReport({ reportId, action: "dismiss", adminId }),
      ).rejects.toThrow(HttpError);
      await expect(
        adminService.moderateReport({ reportId, action: "dismiss", adminId }),
      ).rejects.toThrow("Report has already been resolved");
    });
  });

  describe("searchUsersService", () => {
    it("should search users", async () => {
      const query: SearchUsersQuery = {
        query: "testuser",
        limit: 10,
      };

      const mockUsers: UserSearchResult[] = [
        {
          id: "user-123",
          username: "testuser",
          displayName: "Test User",
          email: "test@example.com",
          status: "active",
          role: "athlete",
        },
      ];

      mockAdminRepo.searchUsers.mockResolvedValue(mockUsers);

      const result = await adminService.searchUsersService(query);

      expect(result).toEqual(mockUsers);
      expect(mockAdminRepo.searchUsers).toHaveBeenCalledWith(query);
    });

    it("allows an empty query to list users", async () => {
      const query: SearchUsersQuery = { query: "", limit: 10 };
      const mockUsers = [{ id: "user-123" }];
      mockAdminRepo.searchUsers.mockResolvedValue(mockUsers);

      await expect(adminService.searchUsersService(query)).resolves.toEqual(mockUsers);
      expect(mockAdminRepo.searchUsers).toHaveBeenCalledWith(query);
    });

    it("allows whitespace-only queries without rejecting the user listing", async () => {
      const query: SearchUsersQuery = { query: "   ", limit: 10 };
      const mockUsers = [{ id: "user-123" }];
      mockAdminRepo.searchUsers.mockResolvedValue(mockUsers);

      await expect(adminService.searchUsersService(query)).resolves.toEqual(mockUsers);
      expect(mockAdminRepo.searchUsers).toHaveBeenCalledWith(query);
    });
  });

  describe("performUserAction", () => {
    const mockUser = {
      id: "user-123",
      username: "testuser",
      displayName: "Test User",
      email: "test@example.com",
      status: "active",
      role: "athlete",
    };

    it("should update user status to suspended", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "suspend",
        adminId,
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(mockUser);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);

      await adminService.performUserAction(input);

      expect(mockAdminRepo.updateUserStatus).toHaveBeenCalledWith("user-123", "suspended");
    });

    it("should throw error when user not found", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "suspend",
        adminId,
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(null);

      await expect(adminService.performUserAction(input)).rejects.toThrow(HttpError);
      await expect(adminService.performUserAction(input)).rejects.toThrow("User not found");
    });

    it("should throw error when trying to modify self", async () => {
      const input: UserActionInput = {
        userId: adminId,
        action: "suspend",
        adminId,
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        ...mockUser,
        id: adminId,
      });

      await expect(adminService.performUserAction(input)).rejects.toThrow(HttpError);
      await expect(adminService.performUserAction(input)).rejects.toThrow(
        "Cannot perform this action on your own account",
      );
    });

    it("should throw error when trying to modify another admin", async () => {
      const input: UserActionInput = {
        userId: "admin-456",
        action: "suspend",
        adminId,
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        ...mockUser,
        id: "admin-456",
        roleCode: "admin",
      });

      await expect(adminService.performUserAction(input)).rejects.toThrow(HttpError);
      await expect(adminService.performUserAction(input)).rejects.toThrow(
        "Cannot modify another administrator account",
      );
    });

    it("should ban user", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "ban",
        adminId,
        reason: "Violation of terms",
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(mockUser);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);

      await adminService.performUserAction(input);

      expect(mockAdminRepo.updateUserStatus).toHaveBeenCalledWith("user-123", "banned");
    });

    it("should activate user", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "activate",
        adminId,
        reason: "Appeal approved",
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(mockUser);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);

      await adminService.performUserAction(input);

      expect(mockAdminRepo.updateUserStatus).toHaveBeenCalledWith("user-123", "active");
    });

    it("should delete user", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "delete",
        adminId,
        reason: "Account deletion requested",
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(mockUser);
      mockAdminRepo.softDeleteUser.mockResolvedValue(undefined);

      await adminService.performUserAction(input);

      expect(mockAdminRepo.softDeleteUser).toHaveBeenCalledWith("user-123");
    });

    it("should throw error for invalid action", async () => {
      const input: UserActionInput = {
        userId: "user-123",
        action: "invalid" as never,
        adminId,
      };

      mockAdminRepo.getUserForAdmin.mockResolvedValue(mockUser);

      await expect(adminService.performUserAction(input)).rejects.toThrow(HttpError);
      await expect(adminService.performUserAction(input)).rejects.toThrow("Invalid user action");
    });
  });
});
