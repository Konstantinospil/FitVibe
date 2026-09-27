#!/usr/bin/env tsx
import crypto from "node:crypto";
import { db } from "../src/db/connection.js";

const target = process.env.SUPERADMIN_USERNAME?.trim();
const reason = process.env.SUPERADMIN_BOOTSTRAP_REASON?.trim();

if (!target || !reason) {
  console.error("Set SUPERADMIN_USERNAME and non-blank SUPERADMIN_BOOTSTRAP_REASON.");
  process.exit(1);
}

async function run(): Promise<void> {
  await db.transaction(async (trx) => {
    const existing = await trx("users")
      .where({ role_code: "superadmin" })
      .whereNull("deleted_at")
      .count<{ count: string }>("id as count")
      .first();

    if (Number(existing?.count ?? 0) > 0) {
      throw new Error("Bootstrap refused: a superadmin already exists.");
    }

    const user = await trx("users as u")
      .join("profiles as p", "p.user_id", "u.id")
      .leftJoin("user_2fa_settings as t", "t.user_id", "u.id")
      .select(
        "u.id",
        "u.role_code as role",
        "u.status",
        trx.raw("COALESCE(t.is_enabled, false) AND COALESCE(t.is_verified, false) as \"totpVerified\""),
      )
      .whereRaw("LOWER(p.alias) = ?", [target.toLowerCase()])
      .whereNull("u.deleted_at")
      .first<{ id: string; role: string; status: string; totpVerified: boolean }>();

    if (!user) {
      throw new Error("Bootstrap target not found.");
    }
    if (user.role !== "admin" || user.status !== "active") {
      throw new Error("Bootstrap target must be an active admin.");
    }
    if (!user.totpVerified) {
      throw new Error("Bootstrap target must have verified authenticator TOTP enabled.");
    }

    await trx("users").where({ id: user.id, role_code: "admin" }).update({
      role_code: "superadmin",
      updated_at: trx.fn.now(),
    });

    await trx("auth_sessions").where({ user_id: user.id }).whereNull("revoked_at").update({
      revoked_at: trx.fn.now(),
    });
    await trx("refresh_tokens").where({ user_id: user.id }).whereNull("revoked_at").update({
      revoked_at: trx.fn.now(),
    });

    await trx("audit_log").insert({
      id: crypto.randomUUID(),
      actor_user_id: null,
      entity_type: "user_role",
      entity_id: user.id,
      action: "superadmin_bootstrap",
      outcome: "success",
      metadata: {
        source: "local_cli",
        oldRole: "admin",
        newRole: "superadmin",
        reason,
        targetAlias: target,
      },
      created_at: trx.fn.now(),
    });
  });

  console.log(`Bootstrapped first superadmin: ${target}`);
  console.log("Existing sessions were revoked; sign in again to receive the new role.");
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
