import type { NextFunction, Request, Response } from "express";
import { db } from "../../db/connection.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http.js";
import { isSessionActiveForUser } from "./auth.state.repository.js";
import { verifyAccess } from "./auth.session-tokens.js";
import { is2FAEnabled } from "./two-factor.service.js";

const ENROLLMENT_ENDPOINTS = new Set([
  "GET /auth/2fa/status",
  "GET /auth/2fa/setup",
  "POST /auth/2fa/setup",
  "POST /auth/2fa/enable",
  "POST /auth/2fa/verify",
  "POST /auth/logout",
  // Minimal identity metadata necessary to render the enrolled user's account.
  "GET /users/me",
]);

/**
 * Restrict existing and newly issued admin sessions until verified MFA exists.
 * This guard is mounted before every API router, rather than trusting the
 * frontend or a stale JWT role. Enrollment uses the real authenticated API.
 *
 * Test ownership: #557, backend administrator authentication policy.
 */
export async function enforceAdministratorMfa(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cookieToken = req.cookies?.[env.ACCESS_COOKIE_NAME] as string | undefined;
    const authorization = req.headers.authorization;
    const bearerToken =
      typeof authorization === "string" && /^Bearer\s+\S+$/i.test(authorization)
        ? authorization.replace(/^Bearer\s+/i, "")
        : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) {
      next();
      return;
    }

    // Leave invalid-token rejection to the owning authenticated route. Never
    // grant elevated access on the basis of a token that cannot be verified.
    let identity: { sub: string; sid: string; mfa?: boolean };
    try {
      identity = verifyAccess(token);
    } catch {
      next();
      return;
    }
    if (
      !identity.sub ||
      !identity.sid ||
      !(await isSessionActiveForUser(identity.sid, identity.sub))
    ) {
      next();
      return;
    }
    const role = await db("users")
      .where({ id: identity.sub })
      .first<{ role_code: string }>("role_code");
    if (role?.role_code !== "admin" && role?.role_code !== "superadmin") {
      next();
      return;
    }
    if (identity.mfa === true && (await is2FAEnabled(identity.sub))) {
      next();
      return;
    }

    if (!ENROLLMENT_ENDPOINTS.has(`${req.method} ${req.path}`)) {
      next(new HttpError(403, "ADMIN_2FA_REQUIRED", "Administrator MFA enrollment required"));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
