import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import { assertFreshPrivilegedTotp } from "./superadmin.service.js";

/**
 * Enforces step-up on routes that already require an authenticated administrator.
 * A TOTP is checked against the user's verified authenticator and recorded as
 * consumed, so neither a stale session nor replayed code authorizes a mutation.
 */
export async function requireFreshAdminTotp(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.sub || !req.user.sid) {
    throw new HttpError(401, "UNAUTHENTICATED", "Administrator session required");
  }

  const code = (req.body as { totpCode?: unknown } | undefined)?.totpCode;
  if (typeof code !== "string" || !/^\\d{6}$/.test(code)) {
    throw new HttpError(403, "ADMIN_STEP_UP_REQUIRED", "Fresh administrator TOTP required");
  }

  await assertFreshPrivilegedTotp(req.user.sub, code);
  next();
}
