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
          contentAuthorId: "user-123",
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
          contentAuthorId: "user-123",
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
          contentAuthorId: "user-123",
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
          contentAuthorId: "user-123",
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(mockFeedItem);
      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        id: "user-123",
        username: "testuser",
        roleCode: "athlete",
        status: "active",
      } as UserSearchResult);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);
      mockAdminRepo.hideFeedItem.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.searchUsers).not.toHaveBeenCalled();
      expect(mockAdminRepo.getUserForAdmin).toHaveBeenCalledWith("user-123");
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
          contentAuthorId: "user-123",
      };

      const input: ModerateReportInput = {
        reportId,
        action: "ban",
        adminId,
      };

      mockAdminRepo.getFeedReportById.mockResolvedValue(commentReport);
      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        id: "user-123",
        username: "testuser",
        roleCode: "athlete",
        status: "active",
      } as UserSearchResult);
      mockAdminRepo.updateUserStatus.mockResolvedValue(undefined);
      mockAdminRepo.hideComment.mockResolvedValue(undefined);
      mockAdminRepo.updateReportStatus.mockResolvedValue(undefined);

      await adminService.moderateReport(input);

      expect(mockAdminRepo.hideComment).toHaveBeenCalledWith(commentId);
      expect(mockAdminRepo.updateReportStatus).toHaveBeenCalledWith(reportId, "reviewed", adminId);
    });

    it.each(["admin", "superadmin"])("does not ban a %s report author", async (roleCode) => {
      mockAdminRepo.getFeedReportById.mockResolvedValue(mockReport);
      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        id: "user-123",
        roleCode,
      } as UserSearchResult);

      await expect(adminService.moderateReport({ reportId, action: "ban", adminId }))
        .rejects.toMatchObject({ status: 403, code: "CANNOT_MODIFY_ADMIN" });
      expect(mockAdminRepo.updateUserStatus).not.toHaveBeenCalled();
      expect(mockAdminRepo.hideFeedItem).not.toHaveBeenCalled();
      expect(mockAdminRepo.updateReportStatus).not.toHaveBeenCalled();
    });

    it("does not ban the moderator when they authored the report content", async () => {
      mockAdminRepo.getFeedReportById.mockResolvedValue({
        ...mockReport,
        contentAuthorId: adminId,
      });
      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        id: adminId,
        roleCode: "athlete",
      } as UserSearchResult);

      await expect(adminService.moderateReport({ reportId, action: "ban", adminId }))
        .rejects.toMatchObject({ status: 400, code: "CANNOT_MODIFY_SELF" });
      expect(mockAdminRepo.updateUserStatus).not.toHaveBeenCalled();
    });

    it("does not resolve an author through an ambiguous alias search", async () => {
      mockAdminRepo.getFeedReportById.mockResolvedValue({
        ...mockReport,
        contentAuthorId: null,
      });
      await expect(adminService.moderateReport({ reportId, action: "ban", adminId }))
        .rejects.toMatchObject({ status: 404, code: "REPORT_AUTHOR_NOT_FOUND" });
      expect(mockAdminRepo.searchUsers).not.toHaveBeenCalled();
      expect(mockAdminRepo.updateUserStatus).not.toHaveBeenCalled();
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

    it.each(["admin", "superadmin"])("rejects every management action against a %s", async (roleCode) => {
      mockAdminRepo.getUserForAdmin.mockResolvedValue({
        ...mockUser,
        roleCode,
      } as UserSearchResult);
      for (const action of ["suspend", "ban", "activate", "delete"] as const) {
        await expect(adminService.performUserAction({
          userId: "user-123",
          action,
          adminId,
        })).rejects.toMatchObject({ status: 403, code: "CANNOT_MODIFY_ADMIN" });
      }
      expect(mockAdminRepo.updateUserStatus).not.toHaveBeenCalled();
      expect(mockAdminRepo.softDeleteUser).not.toHaveBeenCalled();
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
