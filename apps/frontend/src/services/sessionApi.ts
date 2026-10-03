import type { SessionStatus, SessionVisibility } from "@fitvibe/contracts";
import { apiClient } from "./httpApi";

// Sessions API (extending from earlier types)
export type { SessionStatus, SessionVisibility };

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
  order_index: number;
  notes?: string | null;
  planned?: SessionExerciseAttributes | null;
  actual?: SessionExerciseActualAttributes | null;
  sets: SessionExerciseSet[];
  created_at?: string;
  updated_at?: string;
}

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
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SessionWithExercises extends Session {
  exercises: SessionExercise[];
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

export interface SessionsListResponse {
  data: SessionWithExercises[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionExerciseInput {
  id?: string;
  exercise_id?: string | null;
  order: number;
  notes?: string | null;
  planned?: SessionExerciseAttributes | null;
  actual?: SessionExerciseActualAttributes | null;
  sets?: Array<{
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
  }>;
}

export interface CreateSessionRequest {
  plan_id?: string | null;
  title?: string | null;
  planned_at: string;
  visibility?: SessionVisibility;
  notes?: string | null;
  recurrence_rule?: string | null;
  exercises?: SessionExerciseInput[];
}

export interface UpdateSessionRequest {
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

export interface CloneSessionRequest {
  planned_at?: string;
  date_offset_days?: number;
  title?: string | null;
  notes?: string | null;
  visibility?: SessionVisibility;
  recurrence_rule?: string | null;
  plan_id?: string | null;
  include_actual?: boolean;
}

export async function listSessions(params?: SessionQuery): Promise<SessionsListResponse> {
  const res = await apiClient.get<SessionsListResponse>("/api/v1/sessions", { params });
  return res.data;
}

export async function getSession(sessionId: string): Promise<SessionWithExercises> {
  const res = await apiClient.get<SessionWithExercises>(`/api/v1/sessions/${sessionId}`);
  return res.data;
}

export async function createSession(payload: CreateSessionRequest): Promise<SessionWithExercises> {
  const res = await apiClient.post<SessionWithExercises>("/api/v1/sessions", payload);
  return res.data;
}

export async function updateSession(
  sessionId: string,
  payload: UpdateSessionRequest,
): Promise<SessionWithExercises> {
  const res = await apiClient.patch<SessionWithExercises>(`/api/v1/sessions/${sessionId}`, payload);
  return res.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/v1/sessions/${sessionId}`);
}

export async function cloneSession(
  sessionId: string,
  payload?: CloneSessionRequest,
): Promise<SessionWithExercises> {
  const res = await apiClient.post<SessionWithExercises>(
    `/api/v1/sessions/${sessionId}/clone`,
    payload ?? {},
  );
  return res.data;
}

// Share Links API
export async function createShareLink(
  sessionId: string,
): Promise<{ shareLink: string; url: string; token: string }> {
  const res = await apiClient.post<{ shareLink: string; url: string; token: string }>(
    `/api/v1/sessions/${sessionId}/share`,
  );
  return res.data;
}

export async function revokeShareLink(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/v1/sessions/${sessionId}/share`);
}

export interface SessionEstimate {
  activeDurationSec: number | null;
  restDurationSec: number;
  minimumTotalDurationSec: number | null;
  normalizedMet: number | null;
  estimatedKcalPerMin: number | null;
  estimatedActiveKcal: number | null;
  complete: boolean;
  missingInputs: string[];
}

export async function getSessionEstimate(sessionId: string): Promise<SessionEstimate> {
  const res = await apiClient.get<SessionEstimate>(`/api/v1/sessions/${sessionId}/estimate`);
  return res.data;
}
