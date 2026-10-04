export type UserStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "banned"
  | "pending_deletion"
  | "deleted";

export type SessionStatus = "planned" | "in_progress" | "completed" | "canceled";

export type SessionVisibility = "private" | "followers" | "link" | "public";

export type UserLanguage = "en" | "de" | "fr" | "es" | "el";

export type MeasurementSystem = "metric" | "imperial";

export interface UserPreferences {
  language: UserLanguage;
  measurementSystem: MeasurementSystem;
}

export type UpdateUserPreferences = Partial<UserPreferences>;
