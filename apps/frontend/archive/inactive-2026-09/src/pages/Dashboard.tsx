import React, { useMemo, useState } from "react";
import PageIntro from "../components/PageIntro";
import { Button, Skeleton, VisibilityBadge } from "../components/ui";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics";
import { useTranslation } from "react-i18next";
import type {
  DashboardAggregateRow,
  DashboardGrain,
  DashboardPersonalRecord,
  DashboardRange,
  DashboardSummaryMetric,
} from "../services/api";

const DEFAULT_SUMMARY: DashboardSummaryMetric[] = [
  {
    id: "streak",
    label: "Training streak",
    value: "24 days",
    trend: "+3 vs last week",
  },
  {
    id: "readiness",
    label: "Recovery index",
    value: "82%",
    trend: "Sleep + HRV trending up",
  },
  {
    id: "volume",
    label: "Weekly volume",
    value: "52.3k kg",
    trend: "Target: 60k kg",
  },
];

const DEFAULT_RECORDS: DashboardPersonalRecord[] = [
  { lift: "Back squat", value: "180 kg", achieved: "6 weeks ago", visibility: "public" },
  { lift: "Bench press", value: "115 kg", achieved: "3 weeks ago", visibility: "public" },
  { lift: "Deadlift", value: "210 kg", achieved: "2 weeks ago", visibility: "public" },
];

const DEFAULT_AGGREGATES: Record<
  DashboardGrain,
  Record<DashboardRange, DashboardAggregateRow[]>
> = {
  weekly: {
    "4w": [
      { period: "Week 34", volume: 51250, sessions: 9 },
      { period: "Week 33", volume: 49840, sessions: 8 },
      { period: "Week 32", volume: 47210, sessions: 8 },
      { period: "Week 31", volume: 45500, sessions: 7 },
      { period: "Week 30", volume: 43980, sessions: 7 },
      { period: "Week 29", volume: 42870, sessions: 7 },
    ],
    "8w": [
      { period: "Week 34", volume: 51250, sessions: 9 },
      { period: "Week 33", volume: 49840, sessions: 8 },
      { period: "Week 32", volume: 47210, sessions: 8 },
      { period: "Week 31", volume: 45500, sessions: 7 },
      { period: "Week 30", volume: 43980, sessions: 7 },
      { period: "Week 29", volume: 42870, sessions: 7 },
      { period: "Week 28", volume: 41840, sessions: 6 },
      { period: "Week 27", volume: 40110, sessions: 6 },
    ],
  },
  monthly: {
    "4w": [
      { period: "August", volume: 206720, sessions: 33 },
      { period: "July", volume: 198340, sessions: 31 },
      { period: "June", volume: 189250, sessions: 30 },
      { period: "May", volume: 180410, sessions: 29 },
    ],
    "8w": [
      { period: "August", volume: 206720, sessions: 33 },
      { period: "July", volume: 198340, sessions: 31 },
      { period: "June", volume: 189250, sessions: 30 },
      { period: "May", volume: 180410, sessions: 29 },
      { period: "April", volume: 172890, sessions: 27 },
    ],
  },
};

const formatMetricValue = (value: string | number) =>
  typeof value === "number" ? value.toLocaleString() : value;

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardRange>("4w");
  const [grain, setGrain] = useState<DashboardGrain>("weekly");
  const { data, isLoading, isFetching, error, refetch } = useDashboardAnalytics({ range, grain });

  const rangeLabels: Record<DashboardRange, string> = {
    "4w": t("dashboard.last4Weeks"),
    "8w": t("dashboard.last8Weeks"),
  };

  const grainLabels: Record<DashboardGrain, string> = {
    weekly: t("dashboard.weekly"),
    monthly: t("dashboard.monthly"),
  };

  const summaryMetrics = data?.summary?.length ? data.summary : DEFAULT_SUMMARY;
  const personalRecords = data?.personalRecords?.length ? data.personalRecords : DEFAULT_RECORDS;
  const fallbackAggregates = useMemo(
    () => DEFAULT_AGGREGATES[grain]?.[range] ?? [],
    [grain, range],
  );
  const aggregateRows = data?.aggregates?.length ? data.aggregates : fallbackAggregates;

  const activeRange = data?.meta?.range ?? range;
  const activeGrain = data?.meta?.grain ?? grain;

  return (
    <PageIntro
      eyebrow={t("dashboard.eyebrow")}
      title={t("dashboard.title")}
      description={t("dashboard.description")}
    >
      <section className="grid grid--gap-15">
        {error ? (
          <div
            role="alert"
            className="alert alert--error flex flex--align-center flex--justify-between flex--gap-md flex--wrap rounded-md p-sm"
          >
            <span>We could not refresh analytics right now. Showing the last loaded snapshot.</span>
            <Button size="sm" variant="ghost" type="button" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        <div className="flex flex--wrap flex--gap-md">
          {summaryMetrics.map((metric) => (
            <div key={metric.id} className="metric-card">
              <span className="text-085 text-secondary">{metric.label}</span>
              {isLoading ? (
                <Skeleton height="2rem" />
              ) : (
                <strong className="text-2xl">{formatMetricValue(metric.value)}</strong>
              )}
              {metric.trend ? (
                <span className="text-09" style={{ color: "var(--color-highlight)" }}>
                  {metric.trend}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="card">
          <header className="flex flex--justify-between flex--align-center">
            <strong className="text-11">Personal bests</strong>
            <VisibilityBadge level="public" />
          </header>
          <ul className="list-unstyled grid grid--gap-06">
            {personalRecords.map((entry) => (
              <li key={`${entry.lift}-${entry.value}`} className="grid" style={{ gap: "0.2rem" }}>
                <div className="flex flex--justify-between flex--align-center">
                  <span>{entry.lift}</span>
                  <strong>{entry.value}</strong>
                </div>
                <small className="text-muted">{entry.achieved}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <header className="flex flex--justify-between flex--align-center flex--wrap flex--gap-075">
            <strong className="text-11">Volume aggregates</strong>
            <div className="flex flex--gap-05 flex--wrap">
              <select
                aria-label={t("dashboard.selectRange")}
                value={range}
                onChange={(event) => setRange(event.target.value as DashboardRange)}
                style={{
                  background: "var(--surface-muted-subtle)}",
                  color: "var(--color-text-primary)}",
                  border: "1px solid var(--color-border)}",
                  borderRadius: "12px",
                  padding: "0.35rem 0.75rem",
                }}
              >
                <option value="4w">Last 4 weeks</option>
                <option value="8w">Last 8 weeks</option>
              </select>
              <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                {(
                  [
                    { key: "weekly", label: t("dashboard.weekly") },
                    { key: "monthly", label: t("dashboard.monthly") },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    size="sm"
                    variant={grain === option.key ? "primary" : "secondary"}
                    onClick={() => setGrain(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </header>
          <div className="flex flex--justify-between flex--align-center flex--wrap flex--gap-06 text-085 text-muted">
            <span aria-live="polite">
              Range: {rangeLabels[activeRange]} • Grain: {grainLabels[activeGrain]}
            </span>
            {isFetching && !isLoading ? <span>Refreshing…</span> : null}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-09" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="text-left text-secondary">
                  <th className="pb-05">Period</th>
                  <th className="pb-05">Volume</th>
                  <th className="pb-05">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {aggregateRows.map((row) => (
                  <tr key={`${row.period}-${row.volume}`}>
                    <td style={{ padding: "0.4rem 0" }}>{row.period}</td>
                    <td style={{ padding: "0.4rem 0" }}>{row.volume.toLocaleString()} kg</td>
                    <td style={{ padding: "0.4rem 0" }}>{row.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="text-muted">
            Showing up to 5 periods to keep payloads light on shared dashboards.
          </small>
        </div>
      </section>
    </PageIntro>
  );
};

export default Dashboard;
