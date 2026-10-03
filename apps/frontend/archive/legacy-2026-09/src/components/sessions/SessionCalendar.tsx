import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import type { SessionWithExercises } from "../../services/api";

export interface SessionCalendarProps {
  sessions: SessionWithExercises[];
  onDateClick?: (date: Date) => void;
  onSessionClick?: (sessionId: string) => void;
  currentMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

/**
 * SessionCalendar component - Calendar view with ARIA support.
 * Displays sessions in a calendar grid with keyboard navigation.
 */
export const SessionCalendar: React.FC<SessionCalendarProps> = ({
  sessions,
  onDateClick,
  onSessionClick,
  currentMonth = new Date(),
  onMonthChange,
}) => {
  const { t } = useTranslation("common");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithExercises[]>();
    sessions.forEach((session) => {
      const date = new Date(session.planned_at);
      const dateKey = date.toISOString().split("T")[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(session);
    });
    return map;
  }, [sessions]);

  const handlePreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    onMonthChange?.(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    onMonthChange?.(newDate);
  };

  const handleDateClick = (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const getSessionsForDate = (day: number): SessionWithExercises[] => {
    const date = new Date(year, month, day);
    const dateKey = date.toISOString().split("T")[0];
    return sessionsByDate.get(dateKey) || [];
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const weekDays = [
    t("calendar.monday") || "Mon",
    t("calendar.tuesday") || "Tue",
    t("calendar.wednesday") || "Wed",
    t("calendar.thursday") || "Thu",
    t("calendar.friday") || "Fri",
    t("calendar.saturday") || "Sat",
    t("calendar.sunday") || "Sun",
  ];

  const monthName = currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const days = [];
  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex--align-center flex--justify-between">
          <CardTitle>{monthName}</CardTitle>
          <div className="flex flex--gap-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousMonth}
              aria-label={t("calendar.previousMonth") || "Previous month"}
              leftIcon={<ChevronLeft size={18} />}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              aria-label={t("calendar.nextMonth") || "Next month"}
              rightIcon={<ChevronRight size={18} />}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="grid"
          aria-label={
            t("calendar.monthView", { month: monthName }) || `Calendar view for ${monthName}`
          }
        >
          {/* Week day headers */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "var(--space-xs)",
              marginBottom: "var(--space-sm)",
            }}
            role="row"
          >
            {weekDays.map((day, index) => (
              <div
                key={index}
                className="text-sm font-weight-600 text-center"
                style={{ padding: "var(--space-xs)" }}
                role="columnheader"
                aria-label={day}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "var(--space-xs)",
            }}
            role="rowgroup"
          >
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} style={{ aspectRatio: "1" }} />;
              }

              const dateSessions = getSessionsForDate(day);
              const isSelected =
                selectedDate?.getDate() === day &&
                selectedDate?.getMonth() === month &&
                selectedDate?.getFullYear() === year;
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className="flex flex--column flex--gap-xs"
                  style={{
                    aspectRatio: "1",
                    padding: "var(--space-xs)",
                    border: isTodayDate
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: isSelected ? "var(--color-primary)" : "var(--color-surface)",
                    color: isSelected ? "var(--color-primary-on)" : "var(--color-text-primary)",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    minHeight: "80px",
                    alignItems: "flex-start",
                  }}
                  aria-label={
                    t("calendar.date", {
                      day,
                      month: monthName,
                      sessions: dateSessions.length,
                    }) || `Date ${day}, ${dateSessions.length} sessions`
                  }
                  aria-pressed={isSelected}
                >
                  <span className="text-sm font-weight-600">{day}</span>
                  {dateSessions.length > 0 && (
                    <div className="flex flex--column flex--gap-05" style={{ width: "100%" }}>
                      {dateSessions.slice(0, 2).map((session) => (
                        <div
                          key={session.id}
                          className="text-xs"
                          style={{
                            padding: "0.125rem 0.25rem",
                            background: isSelected
                              ? "rgba(255, 255, 255, 0.2)"
                              : "var(--color-primary)",
                            color: isSelected
                              ? "var(--color-text-primary-on)"
                              : "var(--color-primary-on)",
                            borderRadius: "var(--radius-sm)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSessionClick?.(session.id);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              onSessionClick?.(session.id);
                            }
                          }}
                        >
                          {session.title || t("calendar.session") || "Session"}
                        </div>
                      ))}
                      {dateSessions.length > 2 && (
                        <div className="text-xs text-secondary">+{dateSessions.length - 2}</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
