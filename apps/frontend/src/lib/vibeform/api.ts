import type {
  UpdateVibeformPreferencesInput,
  VibeformPreferences,
  VibeformProfile,
} from "@fitvibe/types";
import { apiClient } from "../../services/api";

const VIBEFORM_PROFILE_PATH = "/api/v1/vibeforms/me";

export async function getMyVibeformProfile(): Promise<VibeformProfile> {
  const response = await apiClient.get<VibeformProfile>(VIBEFORM_PROFILE_PATH);
  const profile = response.data;
  if (
    !profile ||
    typeof profile !== "object" ||
    !profile.preferences ||
    !profile.metrics ||
    typeof profile.preferences.templateCode !== "string" ||
    typeof profile.metrics.strength !== "number"
  ) {
    throw new Error("Invalid Vibeform profile response");
  }
  return profile;
}

export async function updateMyVibeformPreferences(
  preferences: UpdateVibeformPreferencesInput,
): Promise<VibeformPreferences> {
  const response = await apiClient.put<VibeformPreferences>(
    `${VIBEFORM_PROFILE_PATH}/preferences`,
    preferences,
  );
  return response.data;
}
