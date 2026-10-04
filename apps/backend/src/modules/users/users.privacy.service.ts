import { HttpError } from "../../utils/http.js";
import {
  getPrivacySettings as getPrivacySettingsRow,
  updatePrivacySettings as persistPrivacySettings,
} from "./users.repository.js";
import type { PrivacySettings, UpdatePrivacyDTO } from "./users.types.js";

export async function getPrivacySettings(userId: string): Promise<PrivacySettings> {
  const settings = await getPrivacySettingsRow(userId);
  if (!settings) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }
  return settings;
}

export async function updatePrivacySettings(
  userId: string,
  updates: UpdatePrivacyDTO,
): Promise<PrivacySettings> {
  const settings = await persistPrivacySettings(userId, updates);
  if (!settings) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }
  return settings;
}
