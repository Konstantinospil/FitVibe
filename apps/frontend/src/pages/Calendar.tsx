import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { listSessions, type SessionWithExercises } from "../services/api";
import {
  TrainingPanel,
  TrainingSummaryCard,
  type TrainingStatus,
} from "../components/composites/TrainingSurface";
import "../styles/training-surfaces.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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
  if (sessions.length > 0 && sessions.every((session) => session.status === "cancelled")) {
    return "danger";
  }
  return "default";
};

const CalendarPage: React.FC = () => {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const range = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41);
    gridEnd.setHours(23, 59, 59, 999);
    return { gridStart, gridEnd };
  }, [visibleMonth]);

  const sessions = useQuery({
    queryKey: ["calendar", dateKey(range.gridStart), dateKey(range.gridEnd)],
    queryFn: () =>
      listSessions({
        planned_from: range.gridStart.toISOString(),
        planned_to: range.gridEnd.toISOString(),
        limit: 200,
      }),
    staleTime: 60_000,
  });

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

  const matrix = useMemo(
    () =>
      WEEKDAYS.map((weekday, weekdayIndex) => ({
        weekday,
        dates: Array.from({ length: 6 }, (_, weekIndex) => {
          const date = new Date(range.gridStart);
          date.setDate(range.gridStart.getDate() + weekIndex * 7 + weekdayIndex);
          return date;
        }),
      })),
    [range.gridStart],
  );

  const selectedSessions = sessionsByDay.get(dateKey(selectedDate)) ?? [];
  const history = [...(sessions.data?.data ?? [])]
    .filter((session) => new Date(session.planned_at) < new Date())
    .sort((a, b) => new Date(b.planned_at).getTime() - new Date(a.planned_at).getTime())
    .slice(0, 6);

  const weekEnd = endOfWeek(selectedDate);
  const selectedDayStart = new Date(selectedDate);
  selectedDayStart.setHours(0, 0, 0, 0);
  const weeklyPlan = [...(sessions.data?.data ?? [])]
    .filter((session) => {
      const planned = new Date(session.planned_at);
      return planned >= selectedDayStart && planned <= weekEnd;
    })
    .sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime());

  const moveMonth = (delta: number) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  };

  const moveYear = (delta: number) => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear() + delta, current.getMonth(), 1),
    );
  };

  return (
    <main className="training-page calendar-surface" aria-labelledby="calendar-title">
      <h1 id="calendar-title" className="sr-only">
        Calendar
      </h1>

      <div className="training-grid calendar-surface__grid">
        <TrainingPanel
          title="Calendar"
          className="calendar-surface__month"
          footer={
            <>
              <Button variant="secondary" size="sm">
                Plan a workout
              </Button>
              <Button variant="primary" size="sm">
                Start a workout
              </Button>
              <Button variant="secondary" size="sm">
                Log a workout
              </Button>
            </>
          }
        >
          <div className="calendar-month__heading">
            <div className="calendar-month__nav">
              <IconButton
                icon={<ChevronLeft />}
                label="Previous month"
                size="sm"
                onClick={() => moveMonth(-1)}
              />
              <strong>
                {visibleMonth.toLocaleDateString(undefined, { month: "long" })}
              </strong>
              <IconButton
                icon={<ChevronRight />}
                label="Next month"
                size="sm"
                onClick={() => moveMonth(1)}
              />
            </div>

            <div className="calendar-month__nav">
              <IconButton
                icon={<ChevronLeft />}
                label="Previous year"
                size="sm"
                onClick={() => moveYear(-1)}
              />
              <strong>{visibleMonth.getFullYear()}</strong>
              <IconButton
                icon={<ChevronRight />}
                label="Next year"
                size="sm"
                onClick={() => moveYear(1)}
              />
            </div>
          </div>

          {sessions.isError ? (
            <div className="training-error">Calendar data could not be loaded.</div>
          ) : null}

          <div
            className="calendar-month__matrix"
            role="grid"
            aria-label="Monthly workout calendar"
          >
            {matrix.flatMap(({ weekday, dates }) => [
              <div className="calendar-month__weekday" role="rowheader" key={weekday}>
                {weekday}
              </div>,
              ...dates.map((date) => {
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
                      daySessions.length > 0
                        ? `calendar-month__cell--${dayStatus}`
                        : "",
                    ].join(" ")}
                    role="gridcell"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${date.toDateString()}, ${daySessions.length} workouts`}
                      onClick={() => setSelectedDate(date)}
                    >
                      {String(date.getDate()).padStart(2, "0")}
                    </Button>
                  </div>
                );
              }),
            ])}
          </div>

          <div className="calendar-surface__selected-day">
            <div className="calendar-surface__selected-title">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>

            {selectedSessions.length === 0 ? (
              <div className="training-empty">No workouts on this day.</div>
            ) : (
              selectedSessions.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || "Workout"}
                  meta={new Date(session.planned_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  supporting={`${session.exercises.length} exercise${session.exercises.length === 1 ? "" : "s"}`}
                />
              ))
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel title="History" className="calendar-surface__history">
          <div className="training-scroll">
            {history.length === 0 ? (
              <div className="training-empty">No workout history yet.</div>
            ) : (
              history.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || "Workout summary"}
                  meta={new Date(session.planned_at).toLocaleString()}
                  supporting={session.notes || `${session.exercises.length} exercises`}
                />
              ))
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel title="Weekly workout plan" className="calendar-surface__week">
          <div className="training-scroll">
            {weeklyPlan.length === 0 ? (
              <div className="training-empty">No workouts planned for the rest of this week.</div>
            ) : (
              weeklyPlan.map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  title={session.title || "Workout"}
                  meta={new Date(session.planned_at).toLocaleString()}
                  supporting={session.notes || `${session.exercises.length} exercises`}
                  trailing={
                    <IconButton
                      icon={<MoreHorizontal />}
                      label="Workout options"
                      size="sm"
                      variant="ghost"
                    />
                  }
                />
              ))
            )}
          </div>
        </TrainingPanel>
      </div>
    </main>
  );
};

export default CalendarPage;
