import { apiClient } from "./httpApi";

// Progress API
export interface ProgressSummary {
  totalSessions: number;
  totalVolume: number;
  currentStreak: number;
  personalRecords?: Array<{
    exerciseName: string;
    value: number;
    unit: string;
    achievedAt: string;
    visibility: string;
  }>;
  streakChange?: number;
  sessionsChange?: number;
  volumeChange?: number;
}

export interface TrendDataPoint {
  label: string;
  date: string;
  volume: number;
  sessions: number;
  avgIntensity: number;
}

export interface ExerciseStats {
  exerciseId: string;
  exerciseName: string;
  totalSessions: number;
  totalVolume: number;
  avgVolume: number;
  maxWeight: number;
  trend: "up" | "down" | "stable";
}

export interface ExerciseBreakdown {
  exercises: ExerciseStats[];
  period: number;
}

export async function getProgressSummary(period: number = 30): Promise<ProgressSummary> {
  const res = await apiClient.get<ProgressSummary>("/api/v1/progress/summary", {
    params: { period },
  });
  return res.data;
}

export async function getProgressTrends(params: {
  period?: number;
  group_by?: "day" | "week";
  from?: string; // ISO date string
  to?: string; // ISO date string
}): Promise<TrendDataPoint[]> {
  const res = await apiClient.get<TrendDataPoint[]>("/api/v1/progress/trends", { params });
  return res.data;
}

export async function getExerciseBreakdown(params: {
  period?: number;
  from?: string; // ISO date string
  to?: string; // ISO date string
}): Promise<ExerciseBreakdown> {
  const res = await apiClient.get<ExerciseBreakdown>("/api/v1/progress/exercises", { params });
  return res.data;
}

export interface VibePointsTrendPoint {
  month: string;
  points: number;
}

export interface VibePointsSeries {
  type_code: string;
  points: number;
  trend: VibePointsTrendPoint[];
}

export interface VibePointsResponse {
  period_months: number;
  months: string[];
  overall: {
    points: number;
    trend: VibePointsTrendPoint[];
  };
  vibes: VibePointsSeries[];
}

export async function getVibePoints(periodMonths: number = 12): Promise<VibePointsResponse> {
  const res = await apiClient.get<VibePointsResponse>("/api/v1/progress/vibes", {
    params: { months: periodMonths },
  });
  return res.data;
}

export async function exportProgress(): Promise<Blob> {
  const res = await apiClient.get<Blob>("/api/v1/progress/export", {
    responseType: "blob",
  });
  return res.data;
}
