import { db } from "../../db/connection.js";
import type { PrivacySettings, UpdatePrivacyDTO } from "./users.types.js";

const USERS_TABLE = "users";

export type PrivacySettingsRow = {
  default_visibility: string;
  allow_followers: boolean;
  show_email: boolean;
  show_weight: boolean;
  show_fitness_level: boolean;
};

function mapPrivacyRow(row: PrivacySettingsRow): PrivacySettings {
  return {
    defaultVisibility: row.default_visibility as PrivacySettings["defaultVisibility"],
    allowFollowers: Boolean(row.allow_followers),
    showEmail: Boolean(row.show_email),
    showWeight: Boolean(row.show_weight),
    showFitnessLevel: Boolean(row.show_fitness_level),
  };
}

export async function getPrivacySettings(userId: string): Promise<PrivacySettings | undefined> {
  const row = await db(USERS_TABLE)
    .select(
      "default_visibility",
      "allow_followers",
      "show_email",
      "show_weight",
      "show_fitness_level",
    )
    .where({ id: userId })
    .first<PrivacySettingsRow>();
  return row ? mapPrivacyRow(row) : undefined;
}

export async function updatePrivacySettings(
  userId: string,
  updates: UpdatePrivacyDTO,
): Promise<PrivacySettings | undefined> {
  const patch: Record<string, unknown> = {};
  if (updates.defaultVisibility !== undefined) {
    patch.default_visibility = updates.defaultVisibility;
  }
  if (updates.allowFollowers !== undefined) {
    patch.allow_followers = updates.allowFollowers;
  }
  if (updates.showEmail !== undefined) {
    patch.show_email = updates.showEmail;
  }
  if (updates.showWeight !== undefined) {
    patch.show_weight = updates.showWeight;
  }
  if (updates.showFitnessLevel !== undefined) {
    patch.show_fitness_level = updates.showFitnessLevel;
  }

  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await db(USERS_TABLE).where({ id: userId }).update(patch);
  }

  return getPrivacySettings(userId);
}
