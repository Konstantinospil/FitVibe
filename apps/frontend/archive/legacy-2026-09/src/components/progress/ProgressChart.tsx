import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../ui/Card";
import { Chart, type ChartDatum } from "../ui/Chart";
import Skeleton from "../ui/Skeleton";
import { Button } from "../ui/Button";
import ErrorBoundary from "../ErrorBoundary";

export type ChartType = "area" | "bar";

export interface ProgressChartProps {
  title: string;
  data: ChartDatum[];
  type?: ChartType;
  color?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  emptyMessage?: string;
  dateRange?: { from: string; to: string };
}

/**
 * ProgressChart component wraps the Chart component with loading, error, and empty states.
 * Provides consistent chart display for progress analytics.
 */
export const ProgressChart: React.FC<ProgressChartProps> = ({
  title,
  data,
  type = "area",
  color = "var(--color-success)",
  valueFormatter,
  height = 240,
  loading = false,
  error = null,
  onRetry,
  emptyMessage,
  dateRange,
}) => {
  const { t } = useTranslation("common");

  const chartErrorFallback = (
    <div
      style={{
        padding: "2rem",
        textAlign: "center",
        color: "var(--color-text-secondary)",
        background: "var(--surface-danger-subtle)",
        borderRadius: "12px",
        border: "1px solid var(--border-danger-subtle)",
      }}
    >
      <p style={{ margin: 0, marginBottom: "1rem" }}>
        {t("progress.chartRenderFailed") || `Failed to render ${title} chart`}
      </p>
      {onRetry && (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {t("progress.retry")}
        </Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent>
        <div className="flex flex--justify-between flex--align-center mb-md">
          <strong className="text-lg">{title}</strong>
          {dateRange && (
            <span className="text-sm text-secondary">
              {dateRange.from} → {dateRange.to}
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton width="100%" height={`${height}px`} />
        ) : error ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              background: "var(--surface-danger-subtle)",
              borderRadius: "12px",
              border: "1px solid var(--border-danger-subtle)",
            }}
          >
            <p style={{ margin: 0, marginBottom: "1rem" }}>{t("progress.failedToLoad")}</p>
            {onRetry && (
              <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
                {t("progress.retry")}
              </Button>
            )}
          </div>
        ) : data.length > 0 ? (
          <ErrorBoundary fallback={chartErrorFallback}>
            <Chart
              data={data}
              type={type}
              height={height}
              color={color}
              valueFormatter={valueFormatter}
            />
          </ErrorBoundary>
        ) : (
          <div
            style={{
              height: `${height}px`,
              display: "grid",
              placeItems: "center",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
            }}
          >
            {emptyMessage || t("progress.noData")}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
