import axios from "axios";
import { apiClient } from "./httpApi";

export interface TrainingPlan {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "completed";
  start_date: string | null;
  end_date: string | null;
  session_count: number;
  completed_count: number;
  progress_percent: number | string;
  revision: number;
  archived_at: string | null;
}

export interface TrainingPlanInput {
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export async function listTrainingPlans(): Promise<TrainingPlan[]> {
  const response = await apiClient.get<{ plans: TrainingPlan[] }>("/api/v1/plans");
  return response.data.plans;
}

/** Fetch a fresh strong validator before editing to prevent silent overwrites. */
export async function getTrainingPlan(
  id: string,
): Promise<{ plan: TrainingPlan; etag: string }> {
  const response = await apiClient.get<TrainingPlan>(`/api/v1/plans/${id}`);
  const etag = response.headers.etag;
  if (typeof etag !== "string" || !etag.startsWith('"')) {
    throw new Error("Plan response did not include a strong ETag");
  }
  return { plan: response.data, etag };
}

export async function createTrainingPlan(input: TrainingPlanInput): Promise<TrainingPlan> {
  const response = await apiClient.post<TrainingPlan>("/api/v1/plans", input);
  return response.data;
}

export async function updateTrainingPlan(
  id: string,
  input: TrainingPlanInput,
  etag: string,
): Promise<TrainingPlan> {
  const response = await apiClient.patch<TrainingPlan>(`/api/v1/plans/${id}`, input, {
    headers: { "If-Match": etag },
  });
  return response.data;
}

/** Server archives the plan; attached sessions remain intact. */
export async function deleteTrainingPlan(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/plans/${id}`);
}

export function isTrainingPlanConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 412;
}
