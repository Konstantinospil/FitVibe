import { db } from "../../db/connection.js";
import type { MeasurementSystem, UserLanguage } from "@fitvibe/contracts";
import type { UpdatePreferencesDTO, UserPreferences } from "./users.types.js";

const USERS_TABLE = "users";

type PreferenceRow = {
  preferred_lang: UserLanguage;
  units: MeasurementSystem;
};

function mapPreferences(row: PreferenceRow): UserPreferences {
  return {
    language: row.preferred_lang,
    measurementSystem: row.units,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
  const row = await db(USERS_TABLE)
    .select("preferred_lang", "units")
    .where({ id: userId })
    .first<PreferenceRow>();
  return row ? mapPreferences(row) : undefined;
}

export async function updateUserPreferences(
  userId: string,
  updates: UpdatePreferencesDTO,
): Promise<UserPreferences | undefined> {
  const patch: Record<string, unknown> = {};

  if (updates.language !== undefined) {
    patch.preferred_lang = updates.language;
  }
  if (updates.measurementSystem !== undefined) {
    patch.units = updates.measurementSystem;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    await db(USERS_TABLE).where({ id: userId }).update(patch);
  }

  return getUserPreferences(userId);
}
