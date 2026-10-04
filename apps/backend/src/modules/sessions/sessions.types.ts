import type {
  SessionStatus as SharedSessionStatus,
  SessionVisibility as SharedSessionVisibility,
} from "@fitvibe/contracts";

export type SessionStatus = SharedSessionStatus;
export type SessionVisibility = SharedSessionVisibility;

export interface Session {
  id: string;
  owner_id: string;
  plan_id?: string | null;
  title?: string | null;
  planned_at: string;
  status: SessionStatus;
  visibility: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  calories?: number | null;
  points?: number | null;
  gamification_rebuild_required?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
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

export interface SessionSetInput {
  id?: string;
  order: number;
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
  notes?: string | null;
  planned?: SessionExerciseAttributesInput | null;
  actual?: SessionExerciseActualInput | null;
  sets?: SessionSetInput[];
}

export interface CreateSessionDTO {
  plan_id?: string | null;
  title?: string | null;
  planned_at: string;
  visibility?: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  exercises?: SessionExerciseInput[];
}

export interface UpdateSessionDTO {
  plan_id?: string | null;
  title?: string | null;
  planned_at?: string;
  status?: SessionStatus;
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
  notes?: string | null;
  planned?: SessionExerciseAttributes | null;
  actual?: SessionExerciseActualAttributes | null;
  sets: SessionExerciseSet[];
  created_at?: string;
  updated_at?: string;
}

export interface SessionWithExercises extends Session {
  exercises: SessionExercise[];
}
