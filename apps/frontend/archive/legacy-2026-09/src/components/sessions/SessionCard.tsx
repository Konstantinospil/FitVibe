import React from "react";
import { Calendar, Play, Eye, Trash2 } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import type { SessionStatus } from "./SessionStatusBadge";
import { SessionStatusBadge } from "./SessionStatusBadge";
import type { SessionWithExercises } from "../../services/api";

export interface SessionCardProps {
  session: SessionWithExercises;
  onStart?: (sessionId: string) => void;
  onView?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  showActions?: boolean;
}

/**
 * SessionCard component displays session information in a card format.
 * Shows title, date, exercises, status, and action buttons.
 */
export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onStart,
  onView,
  onDelete,
  showActions = true,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatus = (): SessionStatus => {
    if (session.status === "completed") {
      return "completed";
    }
    if (session.status === "in_progress") {
      return "in_progress";
    }
    if (session.status === "canceled") {
      return "canceled";
    }
    return "planned";
  };

  return (
    <Card>
      <CardContent>
        <div className="flex flex--align-start flex--gap-md">
          <div style={{ flex: 1 }}>
            <div className="flex flex--align-center flex--gap-075 mb-05">
              <h3 className="text-11 font-weight-600 m-0">{session.title || "Untitled Session"}</h3>
              <SessionStatusBadge status={getStatus()} />
            </div>

            <div
              className="flex flex--align-center flex--gap-md"
              style={{ marginBottom: "0.75rem" }}
            >
              {session.planned_at && (
                <div
                  className="flex flex--align-center flex--gap-05"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: "0.9rem",
                  }}
                >
                  <Calendar size={16} />
                  {formatDate(session.planned_at)}
                </div>
              )}
              {session.exercises && session.exercises.length > 0 && (
                <div className="text-09 text-secondary">
                  {session.exercises.length}{" "}
                  {session.exercises.length === 1 ? "exercise" : "exercises"}
                </div>
              )}
            </div>

            {session.notes && (
              <p className="text-09 text-secondary" style={{ margin: "0.5rem 0 0" }}>
                {session.notes}
              </p>
            )}

            {session.exercises && session.exercises.length > 0 && (
              <div className="mt-075">
                <div className="flex flex--wrap flex--gap-05">
                  {session.exercises.slice(0, 5).map((ex, idx) => (
                    <span
                      key={idx}
                      className="rounded-sm text-085 text-secondary"
                      style={{
                        padding: "0.35rem 0.75rem",
                        background: "var(--border-subtle)",
                      }}
                    >
                      {ex.exercise_id || "Custom Exercise"}
                    </span>
                  ))}
                  {session.exercises.length > 5 && (
                    <span
                      className="rounded-sm text-085 text-muted"
                      style={{ padding: "0.35rem 0.75rem" }}
                    >
                      +{session.exercises.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex flex--gap-05">
              {onStart && getStatus() === "planned" && (
                <button
                  onClick={() => onStart(session.id)}
                  aria-label="Start session"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--surface-success-subtle)",
                    color: "var(--color-accent)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Play size={18} />
                </button>
              )}
              {onView && (
                <button
                  onClick={() => onView(session.id)}
                  aria-label="View session"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--border-subtle)",
                    color: "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Eye size={18} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(session.id)}
                  aria-label="Delete session"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--surface-danger-subtle)",
                    color: "var(--color-danger)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
