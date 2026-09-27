import type { Request, Response } from "express";
import {
  listPrivilegedAdminsHandler,
  privilegedRoleChangeHandler,
  sudoReauthHandler,
} from "../../../../apps/backend/src/modules/admin/superadmin.controller.js";
import * as superadminService from "../../../../apps/backend/src/modules/admin/superadmin.service.js";
import { HttpError } from "../../../../apps/backend/src/utils/http.js";

jest.mock("../../../../apps/backend/src/modules/admin/superadmin.service.js");

const mockService = jest.mocked(superadminService);

describe("Superadmin Controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: {
        sub: "superadmin-1",
        role: "superadmin",
        sid: "session-1",
      },
      params: {},
      body: {},
      requestId: "11111111-1111-4111-8111-111111111111",
    };
    res = {
      json: jest.fn().mockReturnThis(),
    };
  });

  it("lists privileged administrators", async () => {
    const users = [
      {
        id: "admin-1",
        username: "admin",
        email: "admin@example.test",
        role: "admin" as const,
        status: "active",
        totpVerified: true,
      },
    ];
    mockService.listPrivilegedAdmins.mockResolvedValue(users);

    await listPrivilegedAdminsHandler(req as Request, res as Response);

    expect(mockService.listPrivilegedAdmins).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ users });
  });

  it("creates a sudo grant from password reauthentication", async () => {
    req.body = { password: "correct-password" };
    mockService.beginSudo.mockResolvedValue({ expiresAt: "2026-09-27T16:00:00.000Z" });

    await sudoReauthHandler(req as Request, res as Response);

    expect(mockService.beginSudo).toHaveBeenCalledWith(
      "superadmin-1",
      "session-1",
      "correct-password",
      req.requestId,
    );
    expect(res.json).toHaveBeenCalledWith({ expiresAt: "2026-09-27T16:00:00.000Z" });
  });

  it("rejects sudo without authentication", async () => {
    req.user = undefined;
    req.body = { password: "password" };

    await expect(sudoReauthHandler(req as Request, res as Response)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    } satisfies Partial<HttpError>);
    expect(mockService.beginSudo).not.toHaveBeenCalled();
  });

  it("rejects sudo without a password", async () => {
    req.body = {};

    await expect(sudoReauthHandler(req as Request, res as Response)).rejects.toMatchObject({
      status: 400,
      code: "PASSWORD_REQUIRED",
    } satisfies Partial<HttpError>);
  });

  it("commits an approved privileged role change", async () => {
    req.params = { userId: "admin-2" };
    req.body = {
      role: "superadmin",
      reason: "Operational ownership",
      totpCode: "123456",
    };
    mockService.changePrivilegedRole.mockResolvedValue(undefined);

    await privilegedRoleChangeHandler(req as Request, res as Response);

    expect(mockService.changePrivilegedRole).toHaveBeenCalledWith({
      actorUserId: "superadmin-1",
      actorSessionJti: "session-1",
      targetUserId: "admin-2",
      newRole: "superadmin",
      reason: "Operational ownership",
      totpCode: "123456",
      requestId: req.requestId,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("rejects invalid privileged target roles", async () => {
    req.params = { userId: "admin-2" };
    req.body = { role: "athlete", reason: "x", totpCode: "123456" };

    await expect(privilegedRoleChangeHandler(req as Request, res as Response)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_ROLE",
    } satisfies Partial<HttpError>);
    expect(mockService.changePrivilegedRole).not.toHaveBeenCalled();
  });

  it("requires fresh TOTP for a role change", async () => {
    req.params = { userId: "admin-2" };
    req.body = { role: "superadmin", reason: "x" };

    await expect(privilegedRoleChangeHandler(req as Request, res as Response)).rejects.toMatchObject({
      status: 400,
      code: "TOTP_REQUIRED",
    } satisfies Partial<HttpError>);
  });
});
