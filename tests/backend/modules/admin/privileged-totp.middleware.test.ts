import type { NextFunction, Request, Response } from "express";
import { requireFreshAdminTotp } from "../../../../apps/backend/src/modules/admin/privileged-totp.middleware.js";
import { assertFreshPrivilegedTotp } from "../../../../apps/backend/src/modules/admin/superadmin.service.js";

jest.mock("../../../../apps/backend/src/modules/admin/superadmin.service.js", () => ({
  assertFreshPrivilegedTotp: jest.fn(),
}));

describe("Administrator step-up route guard (Issue 557)", () => {
  const next = jest.fn() as jest.MockedFunction<NextFunction>;
  const response = {} as Response;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(assertFreshPrivilegedTotp).mockResolvedValue(undefined);
  });

  const request = (code?: unknown) =>
    ({
      user: { sub: "admin-user", sid: "session-id", role: "admin" },
      body: code === undefined ? {} : { totpCode: code },
    }) as Request;

  it.each([undefined, null, "invalid", "12345", "1234567", 123456])(
    "fails closed before side effects for invalid proof %s",
    async (code) => {
      await expect(requireFreshAdminTotp(request(code), response, next))
        .rejects.toMatchObject({ status: 403, code: "ADMIN_STEP_UP_REQUIRED" });
      expect(assertFreshPrivilegedTotp).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("refuses an unauthenticated request", async () => {
    await expect(requireFreshAdminTotp({ body: { totpCode: "123456" } } as Request, response, next))
      .rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(assertFreshPrivilegedTotp).not.toHaveBeenCalled();
  });

  it("allows a verified fresh authenticator code", async () => {
    await requireFreshAdminTotp(request("123456"), response, next);
    expect(assertFreshPrivilegedTotp).toHaveBeenCalledWith("admin-user", "123456");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not continue a mutation after TOTP replay rejection", async () => {
    jest.mocked(assertFreshPrivilegedTotp).mockRejectedValueOnce(
      Object.assign(new Error("TOTP replay"), { status: 409, code: "PRIVILEGED_TOTP_ALREADY_USED" }),
    );
    await expect(requireFreshAdminTotp(request("123456"), response, next))
      .rejects.toMatchObject({ status: 409, code: "PRIVILEGED_TOTP_ALREADY_USED" });
    expect(next).not.toHaveBeenCalled();
  });
});
