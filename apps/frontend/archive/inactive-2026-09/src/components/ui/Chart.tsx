import React, { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartType = "area" | "bar";

export type ChartDatum = {
  label: string;
  value: number;
};

export interface ChartProps {
  data: ChartDatum[];
  type?: ChartType;
  height?: number;
  color?: string;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}

const defaultLabelFormatter = (label: string) => label;
const defaultValueFormatter = (value: number) => value.toLocaleString();

const tooltipContainerStyle: React.CSSProperties = {
  background: "var(--chart-tooltip-bg)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-sm) var(--space-md)",
  border: "1px solid var(--chart-tooltip-border)",
  color: "var(--color-text-primary)",
  fontSize: "var(--font-size-sm)",
  boxShadow: "var(--chart-tooltip-shadow)",
};

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  labelFormatter: (label: string) => string;
  valueFormatter: (value: number) => string;
};

export const ChartTooltip: React.FC<TooltipProps> = ({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}) => {
  if (!active || !payload?.length || label === undefined) {
    return null;
  }

  return (
    <div role="presentation" style={tooltipContainerStyle}>
      <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{labelFormatter(label)}</div>
      <div style={{ fontSize: "1.15rem", fontWeight: 600 }}>
        {valueFormatter(payload[0]?.value ?? 0)}
      </div>
    </div>
  );
};

export const Chart: React.FC<ChartProps> = ({
  data,
  type = "area",
  height = 240,
  color = "var(--color-accent)",
  labelFormatter = defaultLabelFormatter,
  valueFormatter = defaultValueFormatter,
}) => {
  const gradientId = useId();

  return (
    <div style={{ width: "100%", height }} data-testid="chart">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid
              stroke="var(--chart-grid-strong)"
              vertical={false}
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "0.75rem", fill: "var(--chart-axis-text)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "0.75rem", fill: "var(--chart-axis-text)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor-fill)" }}
              content={
                <ChartTooltip labelFormatter={labelFormatter} valueFormatter={valueFormatter} />
              }
            />
            <Bar dataKey="value" fill={color} radius={12} />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid-soft)" vertical={false} strokeDasharray="3 6" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              style={{ fontSize: "0.75rem", fill: "var(--chart-axis-text)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              style={{ fontSize: "0.75rem", fill: "var(--chart-axis-text)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--chart-cursor-stroke)", strokeWidth: 1.5 }}
              content={
                <ChartTooltip labelFormatter={labelFormatter} valueFormatter={valueFormatter} />
              }
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
