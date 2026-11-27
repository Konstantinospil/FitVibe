import type {
  SessionCompletionOutcome as SharedSessionCompletionOutcome,
  SessionExerciseStatus as SharedSessionExerciseStatus,
  SessionSetSource as SharedSessionSetSource,
  SessionSetStatus as SharedSessionSetStatus,
  SessionStatus as SharedSessionStatus,
  SessionVisibility as SharedSessionVisibility,
} from "@fitvibe/contracts";

export type SessionStatus = SharedSessionStatus;
export type SessionVisibility = SharedSessionVisibility;
export type SessionSetStatus = SharedSessionSetStatus;
export type SessionSetSource = SharedSessionSetSource;
export type SessionCompletionOutcome = SharedSessionCompletionOutcome;
export type SessionExerciseStatus = SharedSessionExerciseStatus;

export interface Session {
  id: string;
  owner_id: string;
  plan_id?: string | null;
  title?: string | null;
  planned_at: string;
  /** Planned length in minutes; the session occupies [planned_at, planned_at + length). */
  planned_duration_min: number;
  status: SessionStatus;
  visibility: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  /** Set when the session completes (ADR-042); null otherwise. */
  completion_outcome?: SessionCompletionOutcome | null;
  /** ADR-043: start of the current pause, or null while running. */
  paused_at?: string | null;
  /** ADR-043: total length of finished pauses, in seconds. */
  paused_seconds?: number;
  calories?: number | null;
  points?: number | null;
  gamification_rebuild_required?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** A paginated session summary; exercise detail is available via GET /sessions/:id. */
export interface SessionListItem extends Session {
  exercise_count: number;
}

export interface SessionExerciseAttributesInput {
  sets?: number | null;
  reps?: number | null;
  load?: number | null;
  distance?: number | null;
  duration?: string | null;
  rpe?: number | null;
  rest?: string | null;
  extras?: Record<string, unknown>;
}

export interface SessionExerciseActualInput extends SessionExerciseAttributesInput {
  recorded_at?: string | null;
}

/** A set's prescription (ADR-042). The top-level set fields hold performed values. */
export interface SessionSetPlannedValues {
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  rest_sec?: number | null;
}

export interface SessionSetInput {
  id?: string;
  order: number;
  status?: SessionSetStatus;
  source?: SessionSetSource;
  planned?: SessionSetPlannedValues | null;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  rest_sec?: number | null;
  extras?: Record<string, unknown>;
  recorded_at?: string | null;
  notes?: string | null;
}

export interface SessionExerciseInput {
  id?: string;
  exercise_id?: string | null;
  order: number;
  status?: SessionExerciseStatus;
  source?: SessionSetSource;
  notes?: string | null;
  planned?: SessionExerciseAttributesInput | null;
  actual?: SessionExerciseActualInput | null;
  sets?: SessionSetInput[];
}

export interface CreateSessionDTO {
  /** "completed" logs a past workout in one step (manual Log, ADR-042). */
  status?: "planned" | "completed";
  completion_outcome?: SessionCompletionOutcome;
  plan_id?: string | null;
  title?: string | null;
  planned_at: string;
  planned_duration_min?: number;
  visibility?: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  exercises?: SessionExerciseInput[];
}

export interface UpdateSessionDTO {
  plan_id?: string | null;
  title?: string | null;
  planned_at?: string;
  planned_duration_min?: number;
  status?: SessionStatus;
  /** Only accepted when the session transitions to completed; defaults to "completed". */
  completion_outcome?: SessionCompletionOutcome;
  visibility?: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  calories?: number | null;
  exercises?: SessionExerciseInput[];
}

export interface CloneSessionDTO {
  planned_at?: string;
  date_offset_days?: number;
  title?: string | null;
  notes?: string | null;
  visibility?: SessionVisibility;
  recurrence_rule?: string | null;
  plan_id?: string | null;
  include_actual?: boolean;
}

export interface SessionRecurrenceDTO {
  occurrences: number;
  offset_days: number;
  start_from?: string;
  title?: string | null;
  notes?: string | null;
  visibility?: SessionVisibility;
  recurrence_rule?: string | null;
  plan_id?: string | null;
  include_actual?: boolean;
}

export interface SessionQuery {
  status?: SessionStatus;
  plan_id?: string;
  planned_from?: string;
  planned_to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionExerciseAttributes {
  sets?: number | null;
  reps?: number | null;
  load?: number | null;
  distance?: number | null;
  duration?: string | null;
  rpe?: number | null;
  rest?: string | null;
  extras?: Record<string, unknown>;
}

export interface SessionExerciseActualAttributes extends SessionExerciseAttributes {
  recorded_at?: string | null;
}

export interface SessionExerciseSet {
  id: string;
  order_index: number;
  status: SessionSetStatus;
  source: SessionSetSource;
  /** The set's prescription; null when none was recorded (for example historical logs). */
  planned: SessionSetPlannedValues | null;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_sec?: number | null;
  rpe?: number | null;
  rest_sec?: number | null;
  extras?: Record<string, unknown>;
  recorded_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id?: string | null;
  exercise_name?: string | null; // Snapshot of exercise name at time of session creation
  order_index: number;
  status: SessionExerciseStatus;
  source: SessionSetSource;
  notes?: string | null;
  planned?: SessionExerciseAttributes | null;
  actual?: SessionExerciseActualAttributes | null;
  sets: SessionExerciseSet[];
  created_at?: string;
  updated_at?: string;
}

/** How one Vibe's level moved because of a completed session (issue 289). */
export interface SessionVibeChange {
  domain_code: string;
  previous_level: number;
  new_level: number;
  change: number;
}

export interface SessionVibeChanges {
  session_id: string;
  changes: SessionVibeChange[];
}

export interface SessionWithExercises extends Session {
  exercises: SessionExercise[];
}
