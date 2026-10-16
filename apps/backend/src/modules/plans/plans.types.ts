export interface Plan {
  id: string;
  user_id: string;
  name: string;
  status: "active" | "completed";
  progress_percent: string; // Decimal as string from database
  session_count: number;
  completed_count: number;
  start_date: string | null;
  end_date: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
  activated_at?: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreatePlanDTO {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
}

export interface UpdatePlanDTO {
  name?: string;
  status?: "active" | "completed";
  start_date?: string | null;
  end_date?: string | null;
  duration_weeks?: number | null;
  target_frequency?: number | null;
}

export interface PlanWithProgress extends Plan {
  progressPercent: number;
}
