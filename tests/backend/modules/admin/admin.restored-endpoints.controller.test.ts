/**
 * Controller tests for the admin endpoints restored in #649.
 */
import type { Request, Response } from "express";
import {
  changeUserRoleHandler,
  deleteUserAvatarHandler,
  deleteUserDisplayNameHandler,
  getOpsStatusHandler,
  sendPasswordResetHandler,
  sendVerificationEmailHandler,
} from "../../../../apps/backend/src/modules/admin/admin.controller.js";
import * as adminService from "../../../../apps/backend/src/modules/admin/admin.service.js";
import { assertFreshPrivilegedTotp } from "../../../../apps/backend/src/modules/admin/superadmin.service.js";

jest.mock("../../../../apps/backend/src/modules/admin/admin.service.js");
jest.mock("../../../../apps/backend/src/modules/admin/superadmin.service.js", () => ({
  assertFreshPrivilegedTotp: jest.fn(),
}));

const service = jest.mocked(adminService);
const adminId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: Record<string, unknown> = {}): Request {
  return {
    user: { sub: adminId, role: "admin", username: "admin" },
    params: { userId },
    query: {},
    body,
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe("admin controller: restored endpoints (#649)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(assertFreshPrivilegedTotp).mockResolvedValue(undefined);
  });

  it("returns the ops status payload", async () => {
    const payload = { backend: {}, frontend: {}, counts: {} } as never;
    service.getOpsStatus.mockResolvedValue(payload);
    const res = makeResponse();
    await getOpsStatusHandler(makeRequest(), res);
    expect(res.json).toHaveBeenCalledWith(payload);
  });

  describe("changeUserRoleHandler", () => {
    it("changes a role after a fresh TOTP", async () => {
      const res = makeResponse();
      await changeUserRoleHandler(
        makeRequest({ role: "coach", reason: " promoted ", totpCode: "123456" }),
        res,
      );
      expect(assertFreshPrivilegedTotp).toHaveBeenCalledWith(adminId, "123456");
      expect(service.changeUserRole).toHaveBeenCalledWith(userId, "coach", adminId, "promoted");
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it.each(["admin", "superadmin", "", undefined, 7])(
      "rejects role %p before checking TOTP",
      async (role) => {
        await expect(
          changeUserRoleHandler(makeRequest({ role, totpCode: "123456" }), makeResponse()),
        ).rejects.toMatchObject({ status: 400, code: "INVALID_ROLE" });
        expect(assertFreshPrivilegedTotp).not.toHaveBeenCalled();
        expect(service.changeUserRole).not.toHaveBeenCalled();
      },
    );

    it("requires a fresh TOTP", async () => {
      await expect(
        changeUserRoleHandler(makeRequest({ role: "coach" }), makeResponse()),
      ).rejects.toMatchObject({ status: 403, code: "ADMIN_STEP_UP_REQUIRED" });
      expect(service.changeUserRole).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ["deleteUserAvatarHandler", deleteUserAvatarHandler, () => service.deleteUserAvatar],
    [
      "deleteUserDisplayNameHandler",
      deleteUserDisplayNameHandler,
      () => service.deleteUserDisplayName,
    ],
  ] as const)("%s", (_name, handler, target) => {
    it("runs after a fresh TOTP and passes the trimmed reason", async () => {
      await handler(makeRequest({ reason: "  abuse ", totpCode: "654321" }), makeResponse());
      expect(assertFreshPrivilegedTotp).toHaveBeenCalledWith(adminId, "654321");
      expect(target()).toHaveBeenCalledWith(userId, adminId, "abuse");
    });

    it("requires a fresh TOTP", async () => {
      await expect(handler(makeRequest({ totpCode: "12" }), makeResponse())).rejects.toMatchObject({
        code: "ADMIN_STEP_UP_REQUIRED",
      });
      expect(target()).not.toHaveBeenCalled();
    });

    it("rejects an oversized reason", async () => {
      await expect(
        handler(makeRequest({ reason: "x".repeat(501), totpCode: "654321" }), makeResponse()),
      ).rejects.toMatchObject({ code: "INVALID_REASON" });
    });
  });

  it("sends verification and reset emails without a TOTP step-up", async () => {
    await sendVerificationEmailHandler(makeRequest(), makeResponse());
    await sendPasswordResetHandler(makeRequest(), makeResponse());
    expect(service.sendVerificationEmail).toHaveBeenCalledWith(userId, adminId);
    expect(service.sendPasswordResetEmail).toHaveBeenCalledWith(userId, adminId);
    expect(assertFreshPrivilegedTotp).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls", async () => {
    const req = { ...makeRequest(), user: undefined } as unknown as Request;
    await expect(sendPasswordResetHandler(req, makeResponse())).rejects.toMatchObject({
      status: 401,
    });
  });
});
