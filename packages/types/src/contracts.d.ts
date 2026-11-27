export type UserStatus =
  "pending_verification" | "active" | "suspended" | "banned" | "pending_deletion" | "deleted";

export type SessionStatus = "planned" | "in_progress" | "completed" | "canceled";

export type SessionVisibility = "private" | "followers" | "link" | "public";

/** ADR-042: only completed sets are performed work. */
export type SessionSetStatus = "planned" | "completed" | "skipped";
/** ADR-042: whether a set belongs to the plan or was added while training. */
export type SessionSetSource = "prescribed" | "added";
/** ADR-042: how a completed session ended. Neither outcome counts as failure. */
export type SessionCompletionOutcome = "completed" | "stopped_early";

export type UserLanguage = "en" | "de" | "fr" | "es" | "el";

export type MeasurementSystem = "metric" | "imperial";

export interface UserPreferences {
  language: UserLanguage;
  measurementSystem: MeasurementSystem;
}

export type UpdateUserPreferences = Partial<UserPreferences>;
