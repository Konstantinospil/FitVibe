import React from "react";
import { useTranslation } from "react-i18next";
import { MetricCard } from "./MetricCard";
import { PersonalBestCard } from "./PersonalBestCard";
import { ProgressChart } from "./ProgressChart";
import type { ChartDatum } from "../ui/Chart";
import { ProgressFilters, type ProgressGroupBy } from "./ProgressFilters";
import { DataTable, type DataTableColumn } from "./DataTable";
import type { DateRange } from "../DateRangePicker";
import type { DashboardSummaryMetric, DashboardPersonalRecord } from "../../services/api";

export interface ProgressDashboardProps {
  summaryMetrics?: DashboardSummaryMetric[];
  personalRecords?: DashboardPersonalRecord[];
  volumeChartData?: ChartDatum[];
  sessionsChartData?: ChartDatum[];
  intensityChartData?: ChartDatum[];
  exerciseBreakdownData?: Array<{
    exerciseId: string;
    exerciseName: string;
    totalSessions: number;
    totalVolume: number;
    avgVolume: number;
    maxWeight: number;
    trend: "up" | "down" | "stable";
  }>;
  loading?: boolean;
  onRangeModeChange?: (mode: "preset" | "custom") => void;
  onPeriodChange?: (period: number) => void;
  onCustomRangeChange?: (range: DateRange) => void;
  onGroupByChange?: (groupBy: ProgressGroupBy) => void;
  onExport?: () => void;
  rangeMode?: "preset" | "custom";
  period?: number;
  customRange?: DateRange;
  groupBy?: ProgressGroupBy;
  isExporting?: boolean;
}

/**
 * ProgressDashboard component provides the main progress analytics dashboard.
 * Combines metrics, charts, personal bests, and filters in a unified view.
 */
export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  summaryMetrics = [],
  personalRecords = [],
  volumeChartData = [],
  sessionsChartData = [],
  intensityChartData = [],
  exerciseBreakdownData = [],
  loading = false,
  onRangeModeChange,
  onPeriodChange,
  onCustomRangeChange,
  onGroupByChange,
  onExport,
  rangeMode = "preset",
  period = 30,
  customRange,
  groupBy = "week",
  isExporting = false,
}) => {
  const { t } = useTranslation("common");

  const exerciseColumns: DataTableColumn[] = [
    {
      key: "exerciseName",
      label: t("progress.exercise"),
    },
    {
      key: "totalSessions",
      label: t("progress.sessions"),
      align: "right",
    },
    {
      key: "totalVolume",
      label: t("progress.totalVolume"),
      align: "right",
      render: (value) => `${((value as number) / 1000).toFixed(1)}k kg`,
    },
    {
      key: "avgVolume",
      label: t("progress.avgVolume"),
      align: "right",
      render: (value) => `${((value as number) / 1000).toFixed(1)}k kg`,
    },
    {
      key: "maxWeight",
      label: t("progress.maxWeight"),
      align: "right",
      render: (value) => {
        if (value === null || value === undefined) {
          return " kg";
        }
        if (typeof value === "object") {
          return `${JSON.stringify(value)} kg`;
        }
        // Handle primitives safely - convert to string explicitly
        let stringValue: string;
        if (typeof value === "string") {
          stringValue = value;
        } else if (typeof value === "number" || typeof value === "boolean") {
          stringValue = String(value);
        } else if (typeof value === "symbol" || typeof value === "bigint") {
          stringValue = value.toString();
        } else {
          // Fallback for any other type - should not happen in practice
          stringValue = JSON.stringify(value);
        }
        return `${stringValue} kg`;
      },
    },
    {
      key: "trend",
      label: t("progress.trend"),
      render: (value) => {
        const trend = value as "up" | "down" | "stable";
        const colors = {
          up: "var(--color-success)",
          down: "var(--color-danger)",
          stable: "var(--color-text-secondary)",
        };
        const labels = {
          up: t("progress.trendUp"),
          down: t("progress.trendDown"),
          stable: t("progress.trendStable"),
        };
        return <span style={{ color: colors[trend] }}>{labels[trend]}</span>;
      },
    },
  ];

  const effectiveRange = customRange || {
    from: new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  };

  return (
    <div className="flex flex--column flex--gap-lg">
      {/* Filters */}
      {(onRangeModeChange || onPeriodChange || onCustomRangeChange || onGroupByChange) && (
        <ProgressFilters
          rangeMode={rangeMode}
          onRangeModeChange={onRangeModeChange || (() => {})}
          period={period}
          onPeriodChange={onPeriodChange || (() => {})}
          customRange={customRange || effectiveRange}
          onCustomRangeChange={onCustomRangeChange || (() => {})}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange || (() => {})}
          onExport={onExport}
          isExporting={isExporting}
        />
      )}

      {/* Summary Metrics */}
      {summaryMetrics.length > 0 && (
        <div className="flex flex--wrap flex--gap-md">
          {summaryMetrics.map((metric) => (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              trend={metric.trend}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Personal Bests */}
      {personalRecords.length > 0 && (
        <PersonalBestCard records={personalRecords} loading={loading} />
      )}

      {/* Volume Trend Chart */}
      {volumeChartData.length > 0 && (
        <ProgressChart
          title={t("progress.volumeTrend")}
          data={volumeChartData}
          type="area"
          color="var(--color-success)"
          valueFormatter={(value) => `${value}k kg`}
          loading={loading}
          dateRange={effectiveRange}
        />
      )}

      {/* Sessions Trend Chart */}
      {sessionsChartData.length > 0 && (
        <ProgressChart
          title={t("progress.sessionsTrend")}
          data={sessionsChartData}
          type="bar"
          color="var(--color-focus)"
          valueFormatter={(value) =>
            `${value} ${value === 1 ? t("progress.session") : t("progress.sessions")}`
          }
          loading={loading}
        />
      )}

      {/* Intensity Trend Chart */}
      {intensityChartData.length > 0 && (
        <ProgressChart
          title={t("progress.intensityTrend")}
          data={intensityChartData}
          type="area"
          color="var(--vibe-strength)"
          valueFormatter={(value) => `${value} RPE`}
          loading={loading}
        />
      )}

      {/* Exercise Breakdown Table */}
      {exerciseBreakdownData.length > 0 && (
        <DataTable
          title={t("progress.exerciseBreakdown")}
          columns={exerciseColumns}
          data={exerciseBreakdownData}
          loading={loading}
          emptyMessage={t("progress.noExerciseData")}
        />
      )}
    </div>
  );
};
