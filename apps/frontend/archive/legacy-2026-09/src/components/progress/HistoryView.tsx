import React from "react";
import { Card, CardContent } from "../ui/Card";
import { SessionCard } from "../sessions/SessionCard";
import Skeleton from "../ui/Skeleton";
import type { SessionWithExercises } from "../../services/api";

export interface HistoryViewProps {
  sessions: SessionWithExercises[];
  loading?: boolean;
  emptyMessage?: string;
  onSessionClick?: (sessionId: string) => void;
  onSessionStart?: (sessionId: string) => void;
  onSessionView?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    category?: string;
    visibility?: string;
  };
}

/**
 * HistoryView component displays session history with filters.
 * Shows completed and planned sessions in a list format.
 */
export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  loading = false,
  emptyMessage,
  onSessionClick: _onSessionClick,
  onSessionStart,
  onSessionView,
  onSessionDelete,
  filters,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex--column flex--gap-md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height="120px" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent>
          <div
            className="flex flex--center"
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {emptyMessage || "No sessions found"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex--column flex--gap-md">
      {filters && (
        <div className="text-sm text-secondary mb-md">
          {filters.dateFrom && filters.dateTo && (
            <span>
              {filters.dateFrom} → {filters.dateTo}
            </span>
          )}
          {filters.category && <span> • Category: {filters.category}</span>}
          {filters.visibility && <span> • Visibility: {filters.visibility}</span>}
        </div>
      )}
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onStart={onSessionStart}
          onView={onSessionView}
          onDelete={onSessionDelete}
          showActions={true}
        />
      ))}
    </div>
  );
};
