import { apiClient } from "./httpApi";

// Exercises API
export interface Exercise {
  id: string;
  name: string;
  type_code: string | null;
  owner_id: string | null;
  muscle_group: string | null;
  equipment: string | null;
  tags: string[];
  is_public: boolean;
  description_en: string | null;
  description_de: string | null;
  met_value?: number | null;
  seconds_per_rep?: number | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export interface CreateExerciseRequest {
  name: string;
  type_code: string;
  muscle_group?: string | null;
  equipment?: string | null;
  tags?: string[];
  is_public?: boolean;
  description_en?: string | null;
  description_de?: string | null;
  met_value?: number | null;
  seconds_per_rep?: number | null;
}

export interface UpdateExerciseRequest {
  name?: string;
  type_code?: string;
  muscle_group?: string | null;
  equipment?: string | null;
  tags?: string[];
  is_public?: boolean;
  description_en?: string | null;
  description_de?: string | null;
  met_value?: number | null;
  seconds_per_rep?: number | null;
}

export interface ExerciseQuery {
  q?: string;
  type_code?: string;
  include_archived?: boolean;
  limit?: number;
  offset?: number;
  owner_id?: string | null;
  muscle_group?: string;
  equipment?: string;
  tags?: string[];
  is_public?: boolean;
}

export interface ExercisesListResponse {
  data: Exercise[];
  total: number;
  limit: number;
  offset: number;
}

export interface CatalogExerciseType {
  code: string;
  name: string;
  description?: string;
}

export async function listExerciseTypes(): Promise<CatalogExerciseType[]> {
  const res = await apiClient.get<CatalogExerciseType[]>("/api/v1/exercise-types");
  return res.data;
}

export async function createExerciseType(payload: {
  code: string;
  name: string;
  description?: string;
}): Promise<CatalogExerciseType> {
  const res = await apiClient.post<CatalogExerciseType>("/api/v1/exercise-types", payload);
  return res.data;
}

export async function updateExerciseType(
  code: string,
  payload: { name?: string; description?: string },
): Promise<CatalogExerciseType> {
  const res = await apiClient.patch<CatalogExerciseType>(`/api/v1/exercise-types/${code}`, payload);
  return res.data;
}

export async function deleteExerciseType(code: string): Promise<void> {
  await apiClient.delete(`/api/v1/exercise-types/${code}`);
}

export async function listExercises(params?: ExerciseQuery): Promise<ExercisesListResponse> {
  const res = await apiClient.get<ExercisesListResponse>("/api/v1/exercises", { params });
  return res.data;
}

export async function getExercise(exerciseId: string): Promise<Exercise> {
  const res = await apiClient.get<Exercise>(`/api/v1/exercises/${exerciseId}`);
  return res.data;
}

export async function createExercise(payload: CreateExerciseRequest): Promise<Exercise> {
  const res = await apiClient.post<Exercise>("/api/v1/exercises", payload);
  return res.data;
}

export async function updateExercise(
  exerciseId: string,
  payload: UpdateExerciseRequest,
): Promise<Exercise> {
  const res = await apiClient.put<Exercise>(`/api/v1/exercises/${exerciseId}`, payload);
  return res.data;
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await apiClient.delete(`/api/v1/exercises/${exerciseId}`);
}
