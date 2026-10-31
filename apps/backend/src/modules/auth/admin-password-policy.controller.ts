import type { Request, Response } from "express";
import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";

/** Current persisted state; no JWT role/attestation claim is trusted. */
export async function administratorPasswordPolicyStatus(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user?.sub) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
  }
  const user = await db("users")
    .where({ id: req.user.sub, status: "active" })
    .first<{ role_code: string; admin_password_policy_verified_at: string | null }>(
      "role_code",
      "admin_password_policy_verified_at",
    );
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Account no longer exists");
  }
  const privileged = user.role_code === "admin" || user.role_code === "superadmin";
  res.json({ passwordChangeRequired: privileged && !user.admin_password_policy_verified_at });
}
