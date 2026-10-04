import { db } from "../../db/connection.js";
import { insertAudit } from "../common/audit.util.js";
import { HttpError } from "../../utils/http.js";
import { deleteStorageObject } from "../../services/mediaStorage.service.js";
import { toError } from "../../utils/error.utils.js";
import { logger } from "../../config/logger.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import crypto from "node:crypto";
import type { UserStatus } from "./users.types.js";

type UserRow = {
  id: string;
  status: UserStatus;
  deleted_at: string | null;
  purge_scheduled_at: string | null;
  backup_purge_due_at: string | null;
};

type MediaRow = { id: string; storage_key: string; owner_id: string };
type ContactRow = { value: string };

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

export interface DeleteSchedule {
  scheduledAt: string;
  purgeDueAt: string;
  backupPurgeDueAt: string;
}

function computeSchedule(now: Date, user: UserRow): DeleteSchedule {
  const purgeDelayMinutes = getRuntimeAppSetting<number>("privacy.dsr_purge_delay_minutes");
  const backupPurgeDays = getRuntimeAppSetting<number>("privacy.dsr_backup_purge_days");
  const scheduledAt = user.deleted_at ?? now.toISOString();
  const purgeDueAt =
    user.purge_scheduled_at ??
    new Date(now.getTime() + purgeDelayMinutes * MILLISECONDS_PER_MINUTE).toISOString();
  const backupPurgeDueAt =
    user.backup_purge_due_at ??
    new Date(now.getTime() + backupPurgeDays * MILLISECONDS_PER_DAY).toISOString();

  return { scheduledAt, purgeDueAt, backupPurgeDueAt };
}

export async function scheduleAccountDeletion(
  userId: string,
  now: Date = new Date(),
): Promise<DeleteSchedule> {
  const user = (await db<UserRow>("users").where({ id: userId }).first<UserRow>()) ?? null;
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "User not found");
  }

  const schedule = computeSchedule(now, user);

  await db("users").where({ id: userId }).update({
    deleted_at: schedule.scheduledAt,
    purge_scheduled_at: schedule.purgeDueAt,
    backup_purge_due_at: schedule.backupPurgeDueAt,
    updated_at: new Date().toISOString(),
  });

  await insertAudit({
    actorUserId: userId,
    entityType: "users",
    action: "delete_scheduled",
    entityId: userId,
    metadata: { ...schedule },
  });

  return schedule;
}

async function cleanupMedia(userId: string): Promise<MediaRow[]> {
  const mediaRows = await db<MediaRow>("media").where("owner_id", userId).select();
  await Promise.all(
    mediaRows.map(async (row) => {
      try {
        await deleteStorageObject(row.storage_key);
      } catch (error) {
        logger.warn(
          {
            err: toError(error),
            storageKey: row.storage_key,
          },
          "[dsr-purge] storage cleanup failed",
        );
      }
    }),
  );
  return mediaRows;
}

export async function executeAccountDeletion(userId: string): Promise<void> {
  const user = (await db<UserRow>("users").where({ id: userId }).first<UserRow>()) ?? null;
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "User not found");
  }
  if (user.status !== "pending_deletion") {
    throw new HttpError(
      400,
      "USER_DELETE_INVALID_STATE",
      "Account must be pending deletion before purge",
    );
  }

  const mediaRows = await cleanupMedia(userId);
  const sessionIds = (await db("sessions")
    .where("owner_id", userId)
    .pluck<string>("id")) as string[];
  const primaryEmailRow = await db<ContactRow>("user_contacts")
    .where("user_id", userId)
    .andWhere("type", "email")
    .andWhere("is_primary", true)
    .first<ContactRow>();
  const profileRow = await db<{ alias: string }>("profiles")
    .where("user_id", userId)
    .first<{ alias: string }>();
  const purgedAt = new Date().toISOString();

  const hashIdentifier = (value: string | null | undefined): string => {
    const source = (value ?? "").trim().toLowerCase();
    return crypto.createHash("sha256").update(source).digest("hex");
  };

  await db.transaction(async (trx) => {
    await trx("user_tombstones").insert({
      user_id: userId,
      email_hash: hashIdentifier(primaryEmailRow?.value),
      alias_hash: hashIdentifier(profileRow?.alias),
      deleted_at: user.deleted_at ?? purgedAt,
      purged_at: purgedAt,
      backup_purge_due_at: user.backup_purge_due_at ?? null,
    });

    await trx("feed_likes").where({ user_id: userId }).del();
    await trx("feed_comments").where({ user_id: userId }).del();
    await trx("feed_reports").where({ reporter_id: userId }).del();
    await trx("session_bookmarks").where({ user_id: userId }).del();
    await trx("feed_items").where({ owner_id: userId }).del();
    await trx("user_blocks").where({ blocker_id: userId }).orWhere({ blocked_id: userId }).del();
    await trx("followers").where({ follower_id: userId }).del();
    await trx("followers").where({ following_id: userId }).del();

    await trx("personal_records").where({ user_id: userId }).del();
    await trx("user_domain_vibe_levels").where({ user_id: userId }).del();
    await trx("vibe_level_changes").where({ user_id: userId }).del();
    await trx("user_points").where({ user_id: userId }).del();
    await trx("badges").where({ user_id: userId }).del();

    await trx("bio_attribute_values").where({ user_id: userId }).del();
    await trx("bio_attribute_selections").where({ user_id: userId }).del();
    await trx("perf_attribute_values").where({ user_id: userId }).del();
    await trx("perf_attribute_selections").where({ user_id: userId }).del();

    await trx("cookie_consents").where({ user_id: userId }).del();
    await trx("pending_2fa_sessions").where({ user_id: userId }).del();
    await trx("backup_codes").where({ user_id: userId }).del();
    await trx("user_2fa_settings").where({ user_id: userId }).del();

    if (sessionIds.length > 0) {
      await trx("exercise_sets")
        .whereIn(
          "session_exercise_id",
          trx("session_exercises").select("id").whereIn("session_id", sessionIds),
        )
        .del();
      await trx("session_exercises").whereIn("session_id", sessionIds).del();
    }

    await trx("sessions").where({ owner_id: userId }).del();
    await trx("exercises").where({ owner_id: userId }).del();
    await trx("plans").where({ user_id: userId }).del();
    await trx("user_contacts").where({ user_id: userId }).del();
    await trx("profiles").where({ user_id: userId }).del();
    await trx("user_state_history").where({ user_id: userId }).del();
    await trx("media").where({ owner_id: userId }).del();
    await trx("auth_tokens").where({ user_id: userId }).del();
    await trx("refresh_tokens").where({ user_id: userId }).del();
    await trx("auth_sessions").where({ user_id: userId }).del();
    await trx("idempotency_keys").where({ user_id: userId }).del();
    await trx("audit_log").where({ actor_user_id: userId }).update({ actor_user_id: null });
    await trx("users").where({ id: userId }).del();
  });

  await insertAudit({
    actorUserId: null,
    entityType: "users",
    action: "account_purged",
    entityId: userId,
    metadata: {
      purgedAt,
      mediaRemoved: mediaRows.length,
      backupPurgeDueAt: user.backup_purge_due_at ?? null,
    },
  });
}

export async function processDueAccountDeletions(now: Date = new Date()): Promise<number> {
  const dueUsers = await db<UserRow>("users")
    .where({ status: "pending_deletion" })
    .whereNotNull("purge_scheduled_at")
    .andWhere("purge_scheduled_at", "<=", now.toISOString())
    .select("id");

  for (const record of dueUsers) {
    await executeAccountDeletion(record.id);
  }

  return dueUsers.length;
}
