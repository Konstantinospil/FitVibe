import type { NextFunction, Request, Response } from "express";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { is2FAEnabled } from "./two-factor.service.js";

const ENROLLMENT_ENDPOINTS = new Set([
  "GET /auth/2fa/status",
  "GET /auth/2fa/setup",
  "POST /auth/2fa/setup",
  "POST /auth/2fa/enable",
  "POST /auth/2fa/verify",
  "POST /auth/logout",
  "GET /users/me",
]);

/**
 * Enforce administrator MFA AFTER requireAccessToken has established a valid
 * server-side session. Never derive authorization from an optional, user-
 * supplied Authorization header here.
 *
 * Test ownership: #557 administrator MFA access control.
 */
export async function enforceAdministratorMfa(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const identity = req.user;
    if (!identity?.sub || !identity.sid) {
      next(new HttpError(401, "UNAUTHENTICATED", "Authentication required"));
      return;
    }

    const role = await db("users")
      .where({ id: identity.sub })
      .first<{ role_code: string; status: string }>(["role_code", "status"]);
    // #557: a missing persisted identity must never inherit non-admin access.
    // A valid JWT and backing session are not sufficient without a live user.
    if (!role || role.status !== "active") {
      next(new HttpError(401, "UNAUTHENTICATED", "Account no longer exists"));
      return;
    }
    if (role.role_code !== "admin" && role.role_code !== "superadmin") {
      next();
      return;
    }
    if (identity.mfa === true && (await is2FAEnabled(identity.sub))) {
      next();
      return;
    }
    const path = req.originalUrl.split("?")[0]?.replace(/^\/api\/v1/, "") ?? "";
    if (ENROLLMENT_ENDPOINTS.has(`${req.method} ${path}`)) {
      next();
      return;
    }
    next(new HttpError(403, "ADMIN_2FA_REQUIRED", "Administrator MFA enrollment required"));
  } catch (error) {
    next(error);
  }
}
