import { apiClient } from "./httpApi";
import type { ProgressSummary, TrendDataPoint } from "./progressApi";

export type DashboardRange = "4w" | "8w";
export type DashboardGrain = "weekly" | "monthly";

export type DashboardSummaryMetric = {
  id: string;
  label: string;
  value: string | number;
  trend?: string;
};

export type DashboardPersonalRecord = {
  lift: string;
  value: string;
  achieved: string;
  visibility: "public" | "link" | "private";
};

export type DashboardAggregateRow = {
  period: string;
  volume: number;
  sessions: number;
};

export type DashboardAnalyticsMeta = {
  range: DashboardRange;
  grain: DashboardGrain;
  totalRows: number;
  truncated: boolean;
};

export type DashboardAnalyticsResponse = {
  summary: DashboardSummaryMetric[];
  personalRecords: DashboardPersonalRecord[];
  aggregates: DashboardAggregateRow[];
  meta: DashboardAnalyticsMeta;
};

const MAX_ANALYTIC_ROWS = 5;

export async function getDashboardAnalytics(params: {
  range: DashboardRange;
  grain: DashboardGrain;
}): Promise<DashboardAnalyticsResponse> {
  // Call the actual progress endpoints
  const period = params.range === "4w" ? 30 : 60;
  const groupBy = params.grain === "weekly" ? "week" : "day";

  const [summaryRes, trendsRes] = await Promise.all([
    apiClient.get<ProgressSummary>("/api/v1/progress/summary", { params: { period } }),
    apiClient.get<TrendDataPoint[]>("/api/v1/progress/trends", {
      params: { period, group_by: groupBy },
    }),
  ]);

  const summary = summaryRes.data;
  const trends = trendsRes.data;

  // Transform backend data to dashboard format
  const summaryMetrics: DashboardSummaryMetric[] = [
    {
      id: "streak",
      label: "Training streak",
      value: summary.currentStreak ? `${summary.currentStreak} days` : "0 days",
      trend: summary.streakChange
        ? `${summary.streakChange > 0 ? "+" : ""}${summary.streakChange} vs last period`
        : "",
    },
    {
      id: "sessions",
      label: "Sessions completed",
      value: summary.totalSessions?.toString() || "0",
      trend: summary.sessionsChange
        ? `${summary.sessionsChange > 0 ? "+" : ""}${summary.sessionsChange} vs last period`
        : "",
    },
    {
      id: "volume",
      label: "Total volume",
      value: summary.totalVolume ? `${(summary.totalVolume / 1000).toFixed(1)}k kg` : "0 kg",
      trend: summary.volumeChange
        ? `${summary.volumeChange > 0 ? "+" : ""}${(summary.volumeChange / 1000).toFixed(1)}k kg vs last period`
        : "",
    },
  ];

  const personalRecords: DashboardPersonalRecord[] = (summary.personalRecords || [])
    .slice(0, 3)
    .map((pr) => ({
      lift: pr.exerciseName || "Unknown",
      value: pr.value ? `${pr.value} ${pr.unit || "kg"}` : "-",
      achieved: pr.achievedAt || "Unknown",
      visibility: (pr.visibility as "public" | "link" | "private") || "private",
    }));

  const aggregates: DashboardAggregateRow[] = (trends || [])
    .slice(0, MAX_ANALYTIC_ROWS)
    .map((row, index: number) => ({
      period: row.label || `Week ${index + 1}`,
      volume: row.volume,
      sessions: row.sessions,
    }));

  return {
    summary: summaryMetrics,
    personalRecords,
    aggregates,
    meta: {
      range: params.range,
      grain: params.grain,
      totalRows: trends?.length || 0,
      truncated: trends?.length > MAX_ANALYTIC_ROWS,
    },
  };
}
