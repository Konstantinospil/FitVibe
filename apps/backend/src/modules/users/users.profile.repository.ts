import crypto from "crypto";
import type { Knex } from "knex";
import { db } from "../../db/connection.js";

const PROFILES_TABLE = "profiles";

function withDb(trx?: Knex.Transaction) {
  return trx ?? db;
}

export type ProfileRow = {
  user_id: string;
  alias: string;
  alias_changed_at: string | null;
  bio: string | null;
  avatar_asset_id: string | null;
  date_of_birth: string | null;
  gender_code: string | null;
  visibility: string;
  fitness_level_code: string | null;
  training_frequency: string | null;
  created_at: string;
  updated_at: string;
};

export type UserMetricRow = {
  id: string;
  user_id: string;
  weight: number | null;
  unit: string | null;
  fitness_level_code: string | null;
  training_frequency: string | null;
  recorded_at: string;
  created_at: string;
};

export interface UserMetrics {
  follower_count: number;
  following_count: number;
  sessions_completed: number;
  total_points: number;
  current_streak_days: number;
}

export async function getUserMetrics(userId: string, trx?: Knex.Transaction): Promise<UserMetrics> {
  const exec = withDb(trx);

  // Get follower count
  const followerResult = await exec("followers")
    .where({ following_id: userId })
    .count<{ count: string | number }>("* as count")
    .first();
  const follower_count = Number(followerResult?.count ?? 0);

  // Get following count
  const followingResult = await exec("followers")
    .where({ follower_id: userId })
    .count<{ count: string | number }>("* as count")
    .first();
  const following_count = Number(followingResult?.count ?? 0);

  // Get sessions completed
  const sessionsResult = await exec("sessions")
    .where({ owner_id: userId, status: "completed" })
    .count<{ count: string | number }>("* as count")
    .first();
  const sessions_completed = Number(sessionsResult?.count ?? 0);

  // Get total points
  const pointsResult = await exec("user_points")
    .where({ user_id: userId })
    .sum<{ total: string | number }>("points as total")
    .first();
  const total_points = Number(pointsResult?.total ?? 0);

  // Calculate current streak (consecutive days with completed sessions)
  const recentSessions = await exec("sessions")
    .where({ owner_id: userId, status: "completed" })
    .whereNotNull("completed_at")
    .orderBy("completed_at", "desc")
    .select<{ completed_at: string | Date }[]>("completed_at")
    .limit(365); // Check up to 1 year back

  let current_streak_days = 0;
  if (recentSessions.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessionDates = new Set<string>();
    for (const session of recentSessions) {
      const date = new Date(session.completed_at as string);
      date.setHours(0, 0, 0, 0);
      sessionDates.add(date.toISOString().split("T")[0]);
    }

    // Check if there's activity today or yesterday (allow for timezone differences)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let checkDate: Date;
    if (sessionDates.has(todayStr)) {
      checkDate = today;
      current_streak_days = 1;
    } else if (sessionDates.has(yesterdayStr)) {
      checkDate = yesterday;
      current_streak_days = 1;
    } else {
      checkDate = today; // Streak is broken
    }

    // Count consecutive days backwards
    if (current_streak_days > 0) {
      for (let i = 1; i < 365; i++) {
        const prevDate = new Date(checkDate);
        prevDate.setDate(prevDate.getDate() - i);
        const prevDateStr = prevDate.toISOString().split("T")[0];

        if (sessionDates.has(prevDateStr)) {
          current_streak_days++;
        } else {
          break;
        }
      }
    }
  }

  return {
    follower_count,
    following_count,
    sessions_completed,
    total_points,
    current_streak_days,
  };
}

export async function getProfileByUserId(
  userId: string,
  trx?: Knex.Transaction,
): Promise<ProfileRow | null> {
  const row = await withDb(trx)<ProfileRow>(PROFILES_TABLE)
    .select([
      "user_id",
      "alias",
      "alias_changed_at",
      "bio",
      "avatar_asset_id",
      "date_of_birth",
      "gender_code",
      "visibility",
      "fitness_level_code",
      "training_frequency",
      "created_at",
      "updated_at",
    ])
    .where({ user_id: userId })
    .first();
  return row ?? null;
}

export async function checkAliasAvailable(
  alias: string,
  excludeUserId?: string,
  trx?: Knex.Transaction,
): Promise<boolean> {
  const query = withDb(trx)<ProfileRow>(PROFILES_TABLE).whereRaw("LOWER(alias) = ?", [
    alias.toLowerCase(),
  ]);

  if (excludeUserId) {
    query.where("user_id", "!=", excludeUserId);
  }

  const existing = await query.first();
  return !existing;
}

export async function updateProfileAlias(
  userId: string,
  alias: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = withDb(trx);
  const now = new Date().toISOString();
  // Ensure profile exists
  const existing = await exec<ProfileRow>(PROFILES_TABLE).where({ user_id: userId }).first();

  if (existing) {
    return exec(PROFILES_TABLE).where({ user_id: userId }).update({
      alias,
      alias_changed_at: now,
      updated_at: now,
    });
  }

  // Create profile if it doesn't exist
  return exec(PROFILES_TABLE).insert({
    user_id: userId,
    alias,
    alias_changed_at: now,
    visibility: "private",
    created_at: now,
    updated_at: now,
  });
}

export async function updateProfileBio(
  userId: string,
  bio: string,
  trx?: Knex.Transaction,
): Promise<number> {
  const exec = withDb(trx);
  const now = new Date().toISOString();
  const existing = await exec<ProfileRow>(PROFILES_TABLE).where({ user_id: userId }).first();

  if (existing) {
    return exec(PROFILES_TABLE).where({ user_id: userId }).update({
      bio,
      updated_at: now,
    });
  }

  return exec(PROFILES_TABLE).insert({
    user_id: userId,
    bio,
    visibility: "private",
    created_at: now,
    updated_at: now,
  });
}

/**
 * Check if user can change alias (rate limiting: max 1 per 30 days)
 * @returns true if alias change is allowed, false if rate limited
 */
export async function canChangeAlias(
  userId: string,
  trx?: Knex.Transaction,
): Promise<{ allowed: boolean; daysRemaining?: number }> {
  const profile = await getProfileByUserId(userId, trx);
  if (!profile || !profile.alias_changed_at) {
    // No previous alias change, allow it
    return { allowed: true };
  }

  const lastChange = new Date(profile.alias_changed_at);
  const now = new Date();
  const daysSinceChange = Math.floor(
    (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceChange >= 30) {
    return { allowed: true };
  }

  const daysRemaining = 30 - daysSinceChange;
  return { allowed: false, daysRemaining };
}

export async function insertUserMetric(
  userId: string,
  metric: {
    weight?: number;
    unit?: string;
    fitness_level_code?: string;
    training_frequency?: string;
  },
  trx?: Knex.Transaction,
): Promise<string> {
  const exec = withDb(trx);
  const now = new Date().toISOString();
  const profilePatch: Record<string, unknown> = { updated_at: now };
  if (metric.fitness_level_code !== undefined) {
    profilePatch.fitness_level_code = metric.fitness_level_code;
  }
  if (metric.training_frequency !== undefined) {
    profilePatch.training_frequency = metric.training_frequency;
  }
  if (Object.keys(profilePatch).length > 1) {
    await exec(PROFILES_TABLE).where({ user_id: userId }).update(profilePatch);
  }

  if (metric.weight === undefined) {
    return userId;
  }

  const attribute = await exec("bio_attributes")
    .where({ key: "weight_kg" })
    .first<{ id: string }>();
  if (!attribute) {
    return userId;
  }
  const [record] = (await exec("bio_attribute_values")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      attribute_id: attribute.id,
      value_number: metric.weight,
      measured_at: now,
      created_at: now,
    })
    .returning("id")) as Array<{ id: string }>;
  return record.id;
}

export async function getLatestUserMetrics(
  userId: string,
  trx?: Knex.Transaction,
): Promise<{
  weight: number | null;
  unit: string | null;
  fitness_level_code: string | null;
  training_frequency: string | null;
} | null> {
  const exec = withDb(trx);
  const profile = await exec<ProfileRow>(PROFILES_TABLE).where({ user_id: userId }).first();
  const weightRow = await exec("bio_attribute_values as v")
    .join("bio_attributes as a", "a.id", "v.attribute_id")
    .where("v.user_id", userId)
    .andWhere("a.key", "weight_kg")
    .orderBy("v.measured_at", "desc")
    .select("v.value_number")
    .first<{ value_number: number | string }>();

  if (!profile && !weightRow) {
    return null;
  }

  return {
    weight: weightRow?.value_number !== undefined ? Number(weightRow.value_number) : null,
    unit: "kg",
    fitness_level_code: profile?.fitness_level_code ?? null,
    training_frequency: profile?.training_frequency ?? null,
  };
}
