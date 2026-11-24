/**
 * Service tests for the admin endpoints restored in #649 (ops status and user admin actions).
 */
import * as adminService from "../../../../apps/backend/src/modules/admin/admin.service.js";
import * as adminRepository from "../../../../apps/backend/src/modules/admin/admin.repository.js";
import { logAudit } from "../../../../apps/backend/src/modules/common/audit.util.js";
import { checkHealth } from "../../../../apps/backend/src/services/antivirus.service.js";
import { deleteStorageObject } from "../../../../apps/backend/src/services/mediaStorage.service.js";
import { deleteUserAvatarMetadata } from "../../../../apps/backend/src/modules/users/users.avatar.repository.js";
import { requestPasswordReset } from "../../../../apps/backend/src/modules/auth/auth.password.service.js";
import { resendVerificationEmail } from "../../../../apps/backend/src/modules/auth/auth.registration.service.js";
import { isEffectiveReadOnly } from "../../../../apps/backend/src/modules/system/app-settings.runtime.js";
import { db } from "../../../../apps/backend/src/db/index.js";
import type { UserSearchResult } from "../../../../apps/backend/src/modules/admin/admin.types.js";

jest.mock("../../../../apps/backend/src/modules/admin/admin.repository.js");
jest.mock("../../../../apps/backend/src/modules/common/audit.util.js", () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/services/antivirus.service.js", () => ({
  checkHealth: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/services/mediaStorage.service.js", () => ({
  deleteStorageObject: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/users/users.avatar.repository.js", () => ({
  deleteUserAvatarMetadata: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.password.service.js", () => ({
  requestPasswordReset: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../../../apps/backend/src/modules/auth/auth.registration.service.js", () => ({
  resendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../apps/backend/src/modules/system/app-settings.runtime.js", () => ({
  isEffectiveReadOnly: jest.fn(),
}));
jest.mock("../../../../apps/backend/src/db/index.js", () => ({
  db: { raw: jest.fn() },
}));

const repo = jest.mocked(adminRepository);
const adminId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const athlete = (overrides: Partial<UserSearchResult> = {}): UserSearchResult => ({
  id: userId,
  username: "runner",
  displayName: "Rude Name",
  email: "runner@example.com",
  roleCode: "athlete",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: null,
  sessionCount: 0,
  reportCount: 0,
  ...overrides,
});

describe("admin service: restored endpoints (#649)", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({ status: 200 });
    jest.mocked(db.raw).mockResolvedValue(undefined as never);
    jest.mocked(checkHealth).mockResolvedValue(true);
    jest.mocked(isEffectiveReadOnly).mockReturnValue(false);
    repo.countActiveSessions.mockResolvedValue(4);
    repo.countOpenMessages.mockResolvedValue(2);
    repo.countPendingReports.mockResolvedValue(3);
    repo.countUnresolvedAuditLogs.mockResolvedValue(5);
  });

  describe("getOpsStatus", () => {
    it("reports green dependencies and sums open work into openIssues", async () => {
      const status = await adminService.getOpsStatus();

      expect(status.backend).toEqual(
        expect.objectContaining({ status: "green", dbOk: true, clamavOk: true, readOnly: false }),
      );
      expect(status.frontend).toEqual({ status: "green", ok: true });
      expect(status.counts).toEqual({
        loggedInUsers: 4,
        unresolvedMessages: 2,
        violationReports: 3,
        unresolvedAuditLogs: 5,
        openIssues: 10,
      });
    });

    it("is yellow while the governed read-only state is active", async () => {
      jest.mocked(isEffectiveReadOnly).mockReturnValue(true);
      const status = await adminService.getOpsStatus();
      expect(status.backend.status).toBe("yellow");
      expect(status.backend.readOnly).toBe(true);
    });

    it("is yellow when the malware scanner is unhealthy", async () => {
      jest.mocked(checkHealth).mockResolvedValue(false);
      expect((await adminService.getOpsStatus()).backend.status).toBe("yellow");
    });

    it("is red without a database and skips the count queries", async () => {
      jest.mocked(db.raw).mockRejectedValue(new Error("connection refused") as never);
      const status = await adminService.getOpsStatus();
      expect(status.backend.status).toBe("red");
      expect(status.counts.openIssues).toBe(0);
      expect(repo.countActiveSessions).not.toHaveBeenCalled();
    });

    it("marks the frontend down when its origin errors or cannot be reached", async () => {
      fetchMock.mockResolvedValueOnce({ status: 502 });
      expect((await adminService.getOpsStatus()).frontend).toEqual({ status: "red", ok: false });
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      expect((await adminService.getOpsStatus()).frontend.ok).toBe(false);
    });
  });

  describe("changeUserRole", () => {
    it("changes a non-privileged role and audits old and new role", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      await adminService.changeUserRole(userId, "coach", adminId, "Certified coach");

      expect(repo.updateUserRole).toHaveBeenCalledWith(userId, "coach");
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user_role_changed",
          entityId: userId,
          userId: adminId,
          metadata: expect.objectContaining({ oldRole: "athlete", newRole: "coach" }),
        }),
      );
    });

    it("refuses privileged targets, self-changes and no-op changes", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete({ roleCode: "admin" }));
      await expect(adminService.changeUserRole(userId, "coach", adminId)).rejects.toMatchObject({
        code: "CANNOT_MODIFY_ADMIN",
      });

      repo.getUserForAdmin.mockResolvedValue(athlete({ id: adminId }));
      await expect(adminService.changeUserRole(adminId, "coach", adminId)).rejects.toMatchObject({
        code: "CANNOT_MODIFY_SELF",
      });

      repo.getUserForAdmin.mockResolvedValue(athlete());
      await expect(adminService.changeUserRole(userId, "athlete", adminId)).rejects.toMatchObject({
        code: "ROLE_UNCHANGED",
      });
      expect(repo.updateUserRole).not.toHaveBeenCalled();
    });

    it("returns 404 for unknown users", async () => {
      repo.getUserForAdmin.mockResolvedValue(null);
      await expect(adminService.changeUserRole(userId, "coach", adminId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("email actions", () => {
    it("re-sends verification only to unverified users through the public flow", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete({ status: "pending_verification" }));
      await adminService.sendVerificationEmail(userId, adminId);
      expect(resendVerificationEmail).toHaveBeenCalledWith("runner@example.com");
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "admin_sent_verification_email" }),
      );

      repo.getUserForAdmin.mockResolvedValue(athlete({ status: "active" }));
      await expect(adminService.sendVerificationEmail(userId, adminId)).rejects.toMatchObject({
        code: "USER_ALREADY_VERIFIED",
      });
    });

    it("sends password resets only to active users through the public flow", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      await adminService.sendPasswordResetEmail(userId, adminId);
      expect(requestPasswordReset).toHaveBeenCalledWith("runner@example.com");

      repo.getUserForAdmin.mockResolvedValue(athlete({ status: "suspended" }));
      await expect(adminService.sendPasswordResetEmail(userId, adminId)).rejects.toMatchObject({
        code: "USER_NOT_ACTIVE",
      });
    });

    it("refuses users without an email and privileged targets", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete({ email: "" }));
      await expect(adminService.sendPasswordResetEmail(userId, adminId)).rejects.toMatchObject({
        code: "NO_EMAIL",
      });

      repo.getUserForAdmin.mockResolvedValue(athlete({ roleCode: "superadmin" }));
      await expect(adminService.sendPasswordResetEmail(userId, adminId)).rejects.toMatchObject({
        code: "CANNOT_MODIFY_ADMIN",
      });
      expect(requestPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe("profile moderation", () => {
    it("deletes the avatar record and file and audits the reason", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      jest.mocked(deleteUserAvatarMetadata).mockResolvedValue({
        id: "media-1",
        storage_key: "avatars/u.png",
      } as never);
      jest.mocked(deleteStorageObject).mockResolvedValue(undefined);

      await adminService.deleteUserAvatar(userId, adminId, "offensive image");

      expect(deleteStorageObject).toHaveBeenCalledWith("avatars/u.png");
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin_deleted_avatar",
          metadata: expect.objectContaining({ reason: "offensive image" }),
        }),
      );
    });

    it("still audits when the stored file is already gone", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      jest.mocked(deleteUserAvatarMetadata).mockResolvedValue({
        id: "media-1",
        storage_key: "avatars/u.png",
      } as never);
      jest.mocked(deleteStorageObject).mockRejectedValue(new Error("ENOENT"));

      await adminService.deleteUserAvatar(userId, adminId);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "admin_deleted_avatar" }),
      );
    });

    it("returns 404 when the user has no avatar", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      jest.mocked(deleteUserAvatarMetadata).mockResolvedValue(null);
      await expect(adminService.deleteUserAvatar(userId, adminId)).rejects.toMatchObject({
        code: "AVATAR_NOT_FOUND",
      });
      expect(logAudit).not.toHaveBeenCalled();
    });

    it("resets the display name to the alias and audits the previous name", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete());
      await adminService.deleteUserDisplayName(userId, adminId, "impersonation");

      expect(repo.resetUserDisplayNameToAlias).toHaveBeenCalledWith(userId);
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin_deleted_display_name",
          metadata: expect.objectContaining({ previousDisplayName: "Rude Name" }),
        }),
      );
    });

    it("refuses to moderate another administrator's profile", async () => {
      repo.getUserForAdmin.mockResolvedValue(athlete({ roleCode: "admin" }));
      await expect(adminService.deleteUserDisplayName(userId, adminId)).rejects.toMatchObject({
        code: "CANNOT_MODIFY_ADMIN",
      });
      expect(repo.resetUserDisplayNameToAlias).not.toHaveBeenCalled();
    });
  });
});
