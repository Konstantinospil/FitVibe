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

export interface CreateExerciseDTO {
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
  owner_id?: string | null; // admin may set to specific user or null for global
}

export interface UpdateExerciseDTO {
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

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
