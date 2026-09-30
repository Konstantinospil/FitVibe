import React from "react";
import { Card, CardContent } from "../ui/Card";
import Skeleton from "../ui/Skeleton";

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  loading?: boolean;
  className?: string;
}

/**
 * MetricCard component displays individual metrics with label, value, and optional trend.
 * Used in dashboards and progress views.
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  loading = false,
  className,
}) => {
  const formatValue = (val: string | number): string => {
    return typeof val === "number" ? val.toLocaleString() : val;
  };

  return (
    <Card
      className={className}
      style={{
        flex: "1 1 200px",
        minWidth: "200px",
        background: "var(--color-surface-glass)",
        border: "1px solid var(--color-border)",
        display: "grid",
        gap: "0.35rem",
      }}
    >
      <CardContent>
        <span
          className="text-sm"
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "0.85rem",
          }}
        >
          {label}
        </span>
        {loading ? (
          <Skeleton height="2rem" />
        ) : (
          <strong
            className="text-2xl"
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {formatValue(value)}
          </strong>
        )}
        {trend && !loading && (
          <span
            className="text-sm"
            style={{
              fontSize: "0.9rem",
              color: "var(--color-highlight)",
            }}
          >
            {trend}
          </span>
        )}
      </CardContent>
    </Card>
  );
};
