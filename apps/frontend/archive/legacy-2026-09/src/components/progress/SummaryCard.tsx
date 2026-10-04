import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import Skeleton from "../ui/Skeleton";

export type SummaryPeriod = "weekly" | "monthly" | "yearly";

export interface SummaryData {
  period: string;
  volume?: number;
  sessions?: number;
  duration?: number;
  intensity?: number;
}

export interface SummaryCardProps {
  title: string;
  period: SummaryPeriod;
  data: SummaryData[];
  loading?: boolean;
  emptyMessage?: string;
}

/**
 * SummaryCard component displays weekly/monthly/yearly summaries.
 * Shows aggregated metrics for a time period.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  period: _period,
  data,
  loading = false,
  emptyMessage,
}) => {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex--column flex--gap-md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height="60px" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex--center"
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {emptyMessage || t("progress.noData")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-md">
          {data.map((item, index) => (
            <div
              key={index}
              className="flex flex--justify-between flex--align-center"
              style={{
                padding: "1rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-surface)",
              }}
            >
              <div className="flex flex--column flex--gap-xs">
                <span className="text-sm font-weight-600">{item.period}</span>
                <div className="flex flex--gap-md text-sm text-secondary">
                  {item.sessions !== undefined && (
                    <span>
                      {item.sessions}{" "}
                      {item.sessions === 1 ? t("progress.session") : t("progress.sessions")}
                    </span>
                  )}
                  {item.volume !== undefined && <span>{(item.volume / 1000).toFixed(1)}k kg</span>}
                  {item.duration !== undefined && <span>{item.duration} min</span>}
                  {item.intensity !== undefined && <span>{item.intensity.toFixed(1)} RPE</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
