import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { Knex } from "knex";

import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { verifyTotpOnly } from "../auth/two-factor.service.js";

const SUDO_TTL_MS = 5 * 60 * 1000;

export interface PrivilegedAdminView {
  id: string;
  username: string | null;
  email: string | null;
  role: "admin" | "superadmin";
  status: string;
  totpVerified: boolean;
}

async function getPrivilegedUser(userId: string, trx: Knex | Knex.Transaction = db) {
  return trx("users as u")
    .leftJoin("profiles as p", "p.user_id", "u.id")
    .leftJoin("user_contacts as c", function () {
      this.on("c.user_id", "=", "u.id")
        .andOn("c.type", "=", trx.raw("?", ["email"]))
        .andOn("c.is_primary", "=", trx.raw("true"));
    })
    .leftJoin("user_2fa_settings as t", "t.user_id", "u.id")
    .select(
      "u.id",
      "p.alias as username",
      "c.value as email",
      "u.role_code as role",
      "u.status",
      trx.raw('COALESCE(t.is_enabled, false) AND COALESCE(t.is_verified, false) as "totpVerified"'),
      "u.password_hash as passwordHash",
    )
    .where("u.id", userId)
    .whereNull("u.deleted_at")
    .first<{
      id: string;
      username: string | null;
      email: string | null;
      role: string;
      status: string;
      totpVerified: boolean;
      passwordHash: string;
    }>();
}

export async function listPrivilegedAdmins(): Promise<PrivilegedAdminView[]> {
  const rows = await db("users as u")
    .leftJoin("profiles as p", "p.user_id", "u.id")
    .leftJoin("user_contacts as c", function () {
      this.on("c.user_id", "=", "u.id")
        .andOn("c.type", "=", db.raw("?", ["email"]))
        .andOn("c.is_primary", "=", db.raw("true"));
    })
    .leftJoin("user_2fa_settings as t", "t.user_id", "u.id")
    .select(
      "u.id",
      "p.alias as username",
      "c.value as email",
      "u.role_code as role",
      "u.status",
      db.raw('COALESCE(t.is_enabled, false) AND COALESCE(t.is_verified, false) as "totpVerified"'),
    )
    .whereIn("u.role_code", ["admin", "superadmin"])
    .whereNull("u.deleted_at")
    .orderBy("u.role_code", "desc")
    .orderBy("p.alias", "asc");

  return rows as PrivilegedAdminView[];
}

export async function beginSudo(
  userId: string,
  sessionJti: string,
  password: string,
  requestId?: string | null,
): Promise<{ expiresAt: string }> {
  const user = await getPrivilegedUser(userId);
  if (!user || user.role !== "superadmin" || user.status !== "active") {
    await insertAudit({
      actorUserId: userId,
      entityType: "privileged_session",
      action: "sudo_reauth",
      outcome: "denied",
      requestId,
      metadata: { reason: "not_active_superadmin" },
    });
    throw new HttpError(403, "SUPERADMIN_REQUIRED", "Superadmin privileges required");
  }
  if (!user.totpVerified) {
    throw new HttpError(403, "SUPERADMIN_TOTP_REQUIRED", "Verified authenticator TOTP is required");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await insertAudit({
      actorUserId: userId,
      entityType: "privileged_session",
      action: "sudo_reauth",
      outcome: "denied",
      requestId,
      metadata: { reason: "invalid_password" },
    });
    throw new HttpError(401, "SUDO_REAUTH_FAILED", "Sudo reauthentication failed");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SUDO_TTL_MS);

  await db.transaction(async (trx) => {
    await trx("sudo_grants")
      .where({ user_id: userId, session_jti: sessionJti })
      .whereNull("revoked_at")
      .update({ revoked_at: now });

    await trx("sudo_grants").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      session_jti: sessionJti,
      issued_at: now,
      expires_at: expiresAt,
      source: "password_reauth",
    });
  });

  await insertAudit({
    actorUserId: userId,
    entityType: "privileged_session",
    action: "sudo_reauth",
    requestId,
    metadata: { expiresAt: expiresAt.toISOString() },
  });

  return { expiresAt: expiresAt.toISOString() };
}

export async function assertActiveSudo(userId: string, sessionJti: string): Promise<void> {
  const grant = await db("sudo_grants")
    .where({ user_id: userId, session_jti: sessionJti })
    .whereNull("revoked_at")
    .where("expires_at", ">", db.fn.now())
    .orderBy("expires_at", "desc")
    .first<{ id: string }>();

  if (!grant) {
    throw new HttpError(403, "SUDO_REQUIRED", "Sudo reauthentication required");
  }
}

export async function changePrivilegedRole(input: {
  actorUserId: string;
  actorSessionJti: string;
  targetUserId: string;
  newRole: "admin" | "superadmin";
  reason: string;
  totpCode: string;
  requestId?: string | null;
}): Promise<void> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new HttpError(
      400,
      "ROLE_CHANGE_REASON_REQUIRED",
      "A non-blank justification is required",
    );
  }

  await assertActiveSudo(input.actorUserId, input.actorSessionJti);

  const totpOk = await verifyTotpOnly(input.actorUserId, input.totpCode);
  if (!totpOk) {
    await insertAudit({
      actorUserId: input.actorUserId,
      entityType: "user_role",
      entityId: input.targetUserId,
      action: "privileged_role_change",
      outcome: "denied",
      requestId: input.requestId,
      metadata: { reason: "invalid_totp", requestedRole: input.newRole },
    });
    throw new HttpError(401, "PRIVILEGED_TOTP_FAILED", "Fresh authenticator TOTP required");
  }

  const totpCodeHash = crypto.createHash("sha256").update(input.totpCode).digest("hex");

  await db.transaction(async (trx) => {
    // A privileged authenticator code is consumed once. Old rows are removed so
    // a coincidental code repetition in a distant future TOTP window is allowed.
    await trx("privileged_totp_uses")
      .where("used_at", "<", new Date(Date.now() - 2 * 60 * 1000))
      .del();

    try {
      await trx("privileged_totp_uses").insert({
        id: crypto.randomUUID(),
        user_id: input.actorUserId,
        code_hash: totpCodeHash,
        used_at: trx.fn.now(),
      });
    } catch (error) {
      const candidate = error as { code?: string };
      if (candidate.code === "23505") {
        throw new HttpError(
          409,
          "PRIVILEGED_TOTP_ALREADY_USED",
          "A fresh authenticator TOTP is required for each privileged change",
        );
      }
      throw error;
    }
    const actor = await getPrivilegedUser(input.actorUserId, trx);
    if (!actor || actor.role !== "superadmin" || actor.status !== "active") {
      throw new HttpError(403, "SUPERADMIN_REQUIRED", "Superadmin privileges required");
    }

    const target = await getPrivilegedUser(input.targetUserId, trx);
    if (!target || !["admin", "superadmin"].includes(target.role)) {
      throw new HttpError(
        400,
        "PRIVILEGED_ROLE_TARGET_INVALID",
        "Target must be an admin or superadmin",
      );
    }

    if (target.role === input.newRole) {
      throw new HttpError(409, "ROLE_UNCHANGED", "Target already has the requested role");
    }

    if (input.newRole === "superadmin") {
      if (target.status !== "active" || !target.totpVerified) {
        throw new HttpError(
          422,
          "SUPERADMIN_PREREQUISITES_NOT_MET",
          "Promotion requires an active admin with verified authenticator TOTP",
        );
      }
    } else if (target.role === "superadmin") {
      const countRow = await trx("users")
        .where({ role_code: "superadmin" })
        .whereNull("deleted_at")
        .count<{ count: string }>("id as count")
        .first();
      if (Number(countRow?.count ?? 0) <= 1) {
        throw new HttpError(409, "LAST_SUPERADMIN", "The last superadmin cannot be demoted");
      }
    }

    await trx("users")
      .where({ id: target.id, role_code: target.role })
      .update({ role_code: input.newRole, updated_at: trx.fn.now() });

    await trx("sudo_grants").where({ user_id: target.id }).whereNull("revoked_at").update({
      revoked_at: trx.fn.now(),
    });

    // Force authorization to be re-evaluated immediately. Existing access tokens
    // carry the previous role, so revoke all target sessions atomically with the role change.
    await trx("auth_sessions").where({ user_id: target.id }).whereNull("revoked_at").update({
      revoked_at: trx.fn.now(),
    });
    await trx("refresh_tokens").where({ user_id: target.id }).whereNull("revoked_at").update({
      revoked_at: trx.fn.now(),
    });

    await trx("audit_log").insert({
      id: crypto.randomUUID(),
      actor_user_id: input.actorUserId,
      entity_type: "user_role",
      entity_id: target.id,
      action: "privileged_role_change",
      outcome: "success",
      request_id: input.requestId ?? null,
      metadata: {
        oldRole: target.role,
        newRole: input.newRole,
        reason,
      },
      created_at: trx.fn.now(),
    });
  });
}
