import { HttpError } from "../../utils/http.js";
import {
  getUserPreferences as getUserPreferencesRow,
  updateUserPreferences as persistUserPreferences,
} from "./users.repository.js";
import type { UpdatePreferencesDTO, UserPreferences } from "./users.types.js";

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const preferences = await getUserPreferencesRow(userId);
  if (!preferences) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }
  return preferences;
}

export async function updateUserPreferences(
  userId: string,
  updates: UpdatePreferencesDTO,
): Promise<UserPreferences> {
  const preferences = await persistUserPreferences(userId, updates);
  if (!preferences) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }
  return preferences;
}
