import { db } from "../../db/connection.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import type { ContactRow, UserRow, ProfileRow } from "./users.repository.js";
import type { UserDataExportBundle } from "./users.types.js";

type SessionRow = { id: string; owner_id: string };
type SessionExerciseRow = { id: string; session_id: string };
type GenericRow = Record<string, unknown>;
type UserPointRow = { id: string; user_id: string; points: number | string; awarded_at?: string };
type BadgeRow = { id: string; user_id: string; badge_type: string; awarded_at: string };
type MediaRow = {
  id: string;
  owner_id: string;
  target_type: string;
  target_id: string;
  storage_key: string;
  file_url: string;
  mime_type: string | null;
  media_type: string | null;
  bytes: number | null;
  created_at: string;
};
type UserStateHistoryRow = {
  id: string;
  user_id: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
};

function cloneExportRows<T extends object>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

export async function collectUserData(userId: string): Promise<UserDataExportBundle> {
  await insertAudit({
    actorUserId: userId,
    entityType: "users",
    action: "data_export_requested",
    entityId: userId,
  });

  const user = await db<UserRow>("users")
    .leftJoin("profiles", "profiles.user_id", "users.id")
    .select<UserRow[]>("users.*", db.raw("profiles.alias as username"))
    .where("users.id", userId)
    .first<UserRow>();
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }

  const contacts = (await db("user_contacts").where({
    user_id: userId,
  })) as unknown as ContactRow[];
  const profileRow = await db<ProfileRow>("profiles")
    .where({ user_id: userId })
    .first<ProfileRow>();
  const profile = profileRow
    ? {
        user_id: profileRow.user_id,
        alias: profileRow.alias,
        bio: profileRow.bio,
        avatar_asset_id: profileRow.avatar_asset_id,
        date_of_birth: profileRow.date_of_birth,
        gender_code: profileRow.gender_code,
        visibility: profileRow.visibility,
        fitness_level_code: profileRow.fitness_level_code,
        training_frequency: profileRow.training_frequency,
        created_at: profileRow.created_at,
        updated_at: profileRow.updated_at,
      }
    : null;

  const [
    bioValues,
    perfValues,
    consents,
    sessions,
    plans,
    exercises,
    pointsHistory,
    badges,
    followers,
    following,
    blocks,
    personalRecords,
    vibeLevels,
    vibeChanges,
    feedItems,
    feedLikes,
    feedComments,
    bookmarks,
    reports,
    twoFactorSettings,
  ] = await Promise.all([
    db<GenericRow>("bio_attribute_values").where({ user_id: userId }).orderBy("measured_at", "asc"),
    db<GenericRow>("perf_attribute_values")
      .where({ user_id: userId })
      .orderBy("measured_at", "asc"),
    db<GenericRow>("cookie_consents").where({ user_id: userId }).orderBy("consent_given_at", "asc"),
    db<SessionRow>("sessions").where({ owner_id: userId }),
    db<GenericRow>("plans").where({ user_id: userId }),
    db<GenericRow>("exercises").where({ owner_id: userId }),
    db<UserPointRow>("user_points").where({ user_id: userId }).orderBy("awarded_at", "asc"),
    db<BadgeRow>("badges").where({ user_id: userId }).orderBy("awarded_at", "asc"),
    db<GenericRow>("followers").where({ following_id: userId }).orderBy("created_at", "asc"),
    db<GenericRow>("followers").where({ follower_id: userId }).orderBy("created_at", "asc"),
    db<GenericRow>("user_blocks")
      .where({ blocker_id: userId })
      .orWhere({ blocked_id: userId })
      .orderBy("created_at", "asc"),
    db<GenericRow>("personal_records").where({ user_id: userId }).orderBy("achieved_at", "asc"),
    db<GenericRow>("user_domain_vibe_levels").where({ user_id: userId }),
    db<GenericRow>("vibe_level_changes").where({ user_id: userId }).orderBy("created_at", "asc"),
    db<GenericRow>("feed_items").where({ owner_id: userId }).orderBy("created_at", "asc"),
    db<GenericRow>("feed_likes").where({ user_id: userId }),
    db<GenericRow>("feed_comments").where({ user_id: userId }),
    db<GenericRow>("session_bookmarks").where({ user_id: userId }),
    db<GenericRow>("feed_reports").where({ reporter_id: userId }),
    db<{ is_enabled: boolean; is_verified: boolean }>("user_2fa_settings")
      .where("user_id", userId)
      .select("is_enabled", "is_verified")
      .first(),
  ]);
  const metrics = {
    bio: bioValues as unknown as GenericRow[],
    perf: perfValues as unknown as GenericRow[],
    consents: consents as unknown as GenericRow[],
  };

  const sessionIds = sessions.map((session) => session.id);
  const totalPoints = pointsHistory.reduce((sum, record) => sum + Number(record.points ?? 0), 0);

  const [sessionExercises, exerciseSets] = await Promise.all([
    sessionIds.length
      ? db<SessionExerciseRow>("session_exercises").whereIn("session_id", sessionIds)
      : Promise.resolve([]),
    sessionIds.length
      ? db<GenericRow>("exercise_sets")
          .join("session_exercises", "session_exercises.id", "exercise_sets.session_exercise_id")
          .whereIn("session_exercises.session_id", sessionIds)
          .select("exercise_sets.*")
      : Promise.resolve([]),
  ]);

  const mediaRows = await db<MediaRow>("media")
    .where({ owner_id: userId })
    .orderBy("created_at", "asc");
  const media = mediaRows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    storageKey: row.storage_key,
    fileUrl: row.file_url,
    mimeType: row.mime_type,
    mediaType: row.media_type,
    bytes: row.bytes ?? null,
    createdAt: row.created_at,
  }));

  const stateHistory = await db<UserStateHistoryRow>("user_state_history")
    .where({ user_id: userId })
    .orderBy("changed_at", "asc");

  const userRecord: Record<string, unknown> = { ...user };
  delete userRecord.password_hash;
  if (!("primary_email" in userRecord)) {
    const primaryContact = contacts.find(
      (contact) => contact.type === "email" && contact.is_primary,
    );
    if (primaryContact) {
      userRecord.primary_email = primaryContact.value;
    }
  }

  const recordCounts: Record<string, number> = {
    contacts: contacts.length,
    sessions: sessions.length,
    sessionExercises: sessionExercises.length,
    sessionSets: exerciseSets.length,
    plans: plans.length,
    personalExercises: exercises.length,
    personalRecords: personalRecords.length,
    metrics: metrics.bio.length + metrics.perf.length + metrics.consents.length,
    pointsHistory: pointsHistory.length,
    badges: badges.length,
    vibeLevels: vibeLevels.length,
    vibeChanges: vibeChanges.length,
    feedItems: feedItems.length,
    media: media.length,
    followers: followers.length,
    following: following.length,
    blocks: blocks.length,
    stateHistory: stateHistory.length,
  };

  await insertAudit({
    actorUserId: userId,
    entityType: "users",
    action: "data_export_completed",
    entityId: userId,
    metadata: { recordCounts },
  });

  return {
    meta: {
      schemaVersion: "2.0.0",
      exportedAt: new Date().toISOString(),
      recordCounts,
    },
    user: { ...userRecord },
    profile,
    contacts: cloneExportRows(contacts),
    metrics: {
      bio: cloneExportRows(metrics.bio),
      perf: cloneExportRows(metrics.perf),
      consents: cloneExportRows(metrics.consents),
    },
    social: {
      followers,
      following,
      blocks,
    },
    exercises: {
      personal: exercises,
      plans,
      personalRecords,
    },
    sessions: {
      items: sessions,
      exercises: sessionExercises,
      sets: exerciseSets,
    },
    points: {
      total: totalPoints,
      history: pointsHistory,
    },
    badges,
    vibe: {
      levels: vibeLevels,
      changes: vibeChanges,
    },
    feed: {
      items: feedItems,
      likes: feedLikes,
      comments: feedComments,
      bookmarks,
      reports,
    },
    twoFactor: {
      isEnabled: Boolean(twoFactorSettings?.is_enabled),
      isVerified: Boolean(twoFactorSettings?.is_verified),
    },
    media,
    stateHistory,
  };
}
