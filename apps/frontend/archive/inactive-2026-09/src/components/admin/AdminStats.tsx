import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { MetricCard } from "../progress/MetricCard";
import { Spinner } from "../ui/Spinner";

export interface AdminStatsData {
  totalUsers?: number;
  activeUsers?: number;
  totalSessions?: number;
  totalReports?: number;
  pendingReports?: number;
}

export interface AdminStatsProps {
  onLoad?: (data: AdminStatsData) => void;
}

/**
 * AdminStats component displays administrative statistics.
 * Shows key metrics for platform management.
 */
export const AdminStats: React.FC<AdminStatsProps> = ({ onLoad }) => {
  const { t } = useTranslation("common");
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, this would call an admin stats API
    // For now, we'll use placeholder data
    const loadStats = () => {
      setIsLoading(true);
      try {
        // TODO: Replace with actual API call
        const data: AdminStatsData = {
          totalUsers: 0,
          activeUsers: 0,
          totalSessions: 0,
          totalReports: 0,
          pendingReports: 0,
        };
        setStats(data);
        onLoad?.(data);
      } catch {
        // Error handling would be done by parent component
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [onLoad]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}>
            <Spinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.stats.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {stats.totalUsers !== undefined && (
            <MetricCard
              label={t("admin.stats.totalUsers")}
              value={stats.totalUsers.toLocaleString()}
            />
          )}
          {stats.activeUsers !== undefined && (
            <MetricCard
              label={t("admin.stats.activeUsers")}
              value={stats.activeUsers.toLocaleString()}
            />
          )}
          {stats.totalSessions !== undefined && (
            <MetricCard
              label={t("admin.stats.totalSessions")}
              value={stats.totalSessions.toLocaleString()}
            />
          )}
          {stats.totalReports !== undefined && (
            <MetricCard
              label={t("admin.stats.totalReports")}
              value={stats.totalReports.toLocaleString()}
            />
          )}
          {stats.pendingReports !== undefined && (
            <MetricCard
              label={t("admin.stats.pendingReports")}
              value={stats.pendingReports.toLocaleString()}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};
