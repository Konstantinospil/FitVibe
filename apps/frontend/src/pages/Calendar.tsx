import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { listSessions, type SessionWithExercises } from "../services/api";
import {
  TrainingPanel,
  TrainingSummaryCard,
  type TrainingStatus,
} from "../components/composites/TrainingSurface";
import { TRAINING_DATA_CONFIG } from "../config/trainingSurfaces";
import { logger } from "../utils/logger";
import WorkoutEditor, { type WorkoutEditorAction } from "../components/composites/WorkoutEditor";
import { RetryErrorPanel } from "../components/composites/StatusPanel";

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfWeek = (date: Date) => {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 7);
  copy.setMilliseconds(-1);
  return copy;
};

const dateKey = (date: Date | string) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

const statusFor = (sessions: SessionWithExercises[]): TrainingStatus => {
  if (sessions.some((session) => session.status === "in_progress")) {
    return "warning";
  }
  if (sessions.some((session) => session.status === "completed")) {
    return "success";
  }
  if (sessions.length > 0 && sessions.every((session) => session.status === "canceled")) {
    return "danger";
  }
  return "default";
};

const CalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [editorAction, setEditorAction] = useState<WorkoutEditorAction | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const range = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + TRAINING_DATA_CONFIG.calendarGridDayCount - 1);
    gridEnd.setHours(23, 59, 59, 999);
    return { gridStart, gridEnd };
  }, [visibleMonth]);

  const sessions = useQuery({
    queryKey: ["calendar", dateKey(range.gridStart), dateKey(range.gridEnd)],
    queryFn: () =>
      listSessions({
        planned_from: range.gridStart.toISOString(),
        planned_to: range.gridEnd.toISOString(),
        limit: TRAINING_DATA_CONFIG.calendarSessionLimit,
      }),
    staleTime: TRAINING_DATA_CONFIG.standardQueryStaleMs,
  });

  useEffect(() => {
    if (sessions.error) {
      logger.apiError(
        "Failed to load calendar sessions",
        sessions.error,
        "/api/v1/sessions",
        "GET",
      );
    }
  }, [sessions.error]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithExercises[]>();
    for (const session of sessions.data?.data ?? []) {
      const key = dateKey(session.planned_at);
      const current = map.get(key) ?? [];
      current.push(session);
      map.set(key, current);
    }
    return map;
  }, [sessions.data]);

  const matrix = useMemo(() => {
    const weekCount = TRAINING_DATA_CONFIG.calendarGridDayCount / 7;
    return Array.from({ length: 7 }, (_, weekdayIndex) => {
      const labelDate = new Date(range.gridStart);
      labelDate.setDate(range.gridStart.getDate() + weekdayIndex);
      return {
        weekday: new Intl.DateTimeFormat(i18n.language, {
          weekday: "short",
        }).format(labelDate),
        dates: Array.from({ length: weekCount }, (_, weekIndex) => {
          const date = new Date(range.gridStart);
          date.setDate(range.gridStart.getDate() + weekIndex * 7 + weekdayIndex);
          return date;
        }),
      };
    });
  }, [i18n.language, range.gridStart]);

  const selectedSessions = sessionsByDay.get(dateKey(selectedDate)) ?? [];
  const history = [...(sessions.data?.data ?? [])]
    .filter((session) => session.status === "completed" || Boolean(session.completed_at))
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.planned_at).getTime() -
        new Date(a.completed_at ?? a.planned_at).getTime(),
    )
    .slice(0, TRAINING_DATA_CONFIG.homePreviousActivitiesLimit);

  const weekEnd = endOfWeek(selectedDate);
  const selectedDayStart = new Date(selectedDate);
  selectedDayStart.setHours(0, 0, 0, 0);
  const weeklyPlan = [...(sessions.data?.data ?? [])]
    .filter((session) => {
      const planned = new Date(session.planned_at);
      return session.status === "planned" && planned >= selectedDayStart && planned <= weekEnd;
    })
    .sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime());

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const moveYear = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1));
  };

  return (
    <main className="training-page calendar-surface" aria-labelledby="calendar-title">
      <h1 id="calendar-title" className="sr-only">
        {t("calendarSurface.title")}
      </h1>

      <div className="training-grid calendar-surface__grid">
        <TrainingPanel
          title={t("calendarSurface.sections.calendar")}
          className="calendar-surface__month"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditorAction("plan")}>
                {t("calendarSurface.actions.plan")}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setEditorAction("start")}>
                {t("calendarSurface.actions.start")}
              </Button>
            </>
          }
        >
          <div className="calendar-month__heading">
            <div className="calendar-month__nav">
              <IconButton
                icon={<ChevronLeft />}
                label={t("calendarSurface.navigation.previousMonth")}
                size="sm"
                onClick={() => moveMonth(-1)}
              />
              <strong>
                {new Intl.DateTimeFormat(i18n.language, {
                  month: "long",
                }).format(visibleMonth)}
              </strong>
              <IconButton
                icon={<ChevronRight />}
                label={t("calendarSurface.navigation.nextMonth")}
                size="sm"
                onClick={() => moveMonth(1)}
              />
            </div>

            <div className="calendar-month__nav">
              <IconButton
                icon={<ChevronLeft />}
                label={t("calendarSurface.navigation.previousYear")}
                size="sm"
                onClick={() => moveYear(-1)}
              />
              <strong>{visibleMonth.getFullYear()}</strong>
              <IconButton
                icon={<ChevronRight />}
                label={t("calendarSurface.navigation.nextYear")}
                size="sm"
                onClick={() => moveYear(1)}
              />
            </div>
          </div>

          {sessions.isError ? (
            <RetryErrorPanel
              message={t("calendarSurface.errors.load")}
              retryLabel={t("actions.retry")}
              onRetry={() => {
                void sessions.refetch();
              }}
              isRetrying={sessions.isFetching}
            />
          ) : null}

          <div
            className="calendar-month__matrix"
            role="grid"
            aria-label={t("calendarSurface.gridLabel")}
          >
            {matrix.map(({ weekday, dates }) => (
              <div className="calendar-month__row" role="row" key={weekday}>
                <div className="calendar-month__weekday" role="rowheader">
                  {weekday}
                </div>
                {dates.map((date) => {
                  const daySessions = sessionsByDay.get(dateKey(date)) ?? [];
                  const outside = date.getMonth() !== visibleMonth.getMonth();
                  const selected = dateKey(date) === dateKey(selectedDate);
                  const dayStatus = statusFor(daySessions);

                  return (
                    <div
                      key={date.toISOString()}
                      className={[
                        "calendar-month__cell",
                        outside ? "calendar-month__cell--outside" : "",
                        selected ? "calendar-month__selected" : "",
                        daySessions.length > 0 ? `calendar-month__cell--${dayStatus}` : "",
                      ].join(" ")}
                      role="gridcell"
                      aria-selected={selected}
                      data-status={dayStatus}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("calendarSurface.dayLabel", {
                          date: new Intl.DateTimeFormat(i18n.language, {
                            dateStyle: "full",
                          }).format(date),
                          count: daySessions.length,
                        })}
                        onClick={() => setSelectedDate(date)}
                      >
                        {String(date.getDate()).padStart(2, "0")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="calendar-surface__selected-day">
            <div className="calendar-surface__selected-title">
              {new Intl.DateTimeFormat(i18n.language, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(selectedDate)}
            </div>

            {selectedSessions.length === 0 ? (
              <div className="training-empty">{t("calendarSurface.empty.selectedDay")}</div>
            ) : (
              selectedSessions.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || t("homeSurface.session.workout")}
                  meta={new Intl.DateTimeFormat(i18n.language, {
                    timeStyle: "short",
                  }).format(new Date(session.planned_at))}
                  supporting={t("homeSurface.session.exercises", {
                    count: session.exercises.length,
                  })}
                />
              ))
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel
          title={t("calendarSurface.sections.history")}
          className="calendar-surface__history"
        >
          <div className="training-scroll">
            {history.length === 0 ? (
              <div className="training-empty">{t("calendarSurface.empty.history")}</div>
            ) : (
              history.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || t("homeSurface.session.workoutSummary")}
                  meta={formatDateTime(session.completed_at ?? session.planned_at)}
                  supporting={
                    session.notes ||
                    t("homeSurface.session.exercises", {
                      count: session.exercises.length,
                    })
                  }
                />
              ))
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel
          title={t("calendarSurface.sections.weekPlan")}
          className="calendar-surface__week"
        >
          <div className="training-scroll">
            {weeklyPlan.length === 0 ? (
              <div className="training-empty">{t("calendarSurface.empty.week")}</div>
            ) : (
              weeklyPlan.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || t("homeSurface.session.workout")}
                  meta={formatDateTime(session.planned_at)}
                  supporting={
                    session.notes ||
                    t("homeSurface.session.exercises", {
                      count: session.exercises.length,
                    })
                  }
                />
              ))
            )}
          </div>
        </TrainingPanel>
      </div>

      <WorkoutEditor
        open={editorAction !== null}
        onClose={() => setEditorAction(null)}
        plannedAt={selectedDayStart.toISOString()}
        actions={editorAction ? [editorAction] : []}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["calendar"] });
        }}
      />
    </main>
  );
};

export default CalendarPage;
