import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Pagination } from "../ui/Pagination";
import { LoadingState } from "../utils/LoadingState";
import { EmptyState } from "../utils/EmptyState";
import { getPointsHistory, type PointsHistoryEntry } from "../../services/api";

export interface PointsHistoryProps {
  limit?: number;
  onLoad?: (entries: PointsHistoryEntry[]) => void;
}

/**
 * PointsHistory component - Display points history log.
 * Shows chronological list of points earned with pagination.
 */
export const PointsHistory: React.FC<PointsHistoryProps> = ({ limit = 20, onLoad }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PointsHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await getPointsHistory({
          limit,
          offset: (currentPage - 1) * limit,
        });
        setEntries(response.entries);
        setTotalPages(Math.ceil(response.total / limit));
        onLoad?.(response.entries);
      } catch {
        // Error handling would be done by parent component
      } finally {
        setIsLoading(false);
      }
    };
    void loadHistory();
  }, [currentPage, limit, onLoad]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gamification.pointsHistory") || "Points History"}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyState
            title={t("gamification.noPointsHistory") || "No points history yet"}
            message={
              t("gamification.noPointsHistoryDescription") ||
              "Start logging sessions to earn points"
            }
          />
        ) : (
          <div className="flex flex--column flex--gap-md">
            <div className="flex flex--column flex--gap-sm">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex--align-center flex--justify-between"
                  style={{
                    padding: "var(--space-md)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-surface)",
                  }}
                >
                  <div className="flex flex--column flex--gap-xs">
                    <span className="text-sm font-weight-600">
                      {entry.description || t("gamification.pointsEarned") || "Points earned"}
                    </span>
                    <span className="text-xs text-secondary">{formatDate(entry.createdAt)}</span>
                  </div>
                  <div
                    className="text-md font-weight-600"
                    style={{ color: "var(--color-primary)" }}
                  >
                    +{entry.points}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
