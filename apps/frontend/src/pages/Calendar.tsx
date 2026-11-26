import React, { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { listSessions, type SessionListItem } from "../services/api";
import {
  TrainingPanel,
  TrainingSummaryCard,
  type TrainingStatus,
} from "../components/composites/TrainingSurface";
import { TRAINING_DATA_CONFIG } from "../config/trainingSurfaces";
import { logger } from "../utils/logger";
import WorkoutEditor, { type WorkoutEditorAction } from "../components/composites/WorkoutEditor";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import PlanManagement from "../components/composites/PlanManagement";
import { FormFeedback } from "../components/composites/FormStack";
import ScheduleSessionCard, {
  ScheduleDragPreview,
} from "../components/composites/ScheduleSessionCard";
import ScheduleSessionChip, {
  ScheduleSessionContinuation,
} from "../components/composites/ScheduleSessionChip";
import ScheduleTimeGrid from "../components/composites/ScheduleTimeGrid";
import CalendarViewSwitch, { type CalendarView } from "../components/composites/CalendarViewSwitch";
import RescheduleSessionDialog from "../components/composites/RescheduleSessionDialog";
import { CALENDAR_QUERY_KEY } from "../hooks/useSessionReschedule";
import { SCHEDULE_DROP_ATTRIBUTE, useCalendarScheduling } from "../hooks/useCalendarScheduling";
import {
  coveredSlotKeys,
  durationOf,
  isReschedulable,
  localDateKey as dateKey,
  sessionEnd,
  slotKey,
} from "../lib/scheduling/sessionSchedule";

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

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

/** Parses a local day key back into a local date at midnight. */
const dayFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const statusFor = (sessions: SessionListItem[]): TrainingStatus => {
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
  const [managePlansOpen, setManagePlansOpen] = useState(false);
  const [view, setView] = useState<CalendarView>("month");
  const [visibleMonth, setVisibleMonth] = useState(() => firstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const range = useMemo(() => {
    const gridStart = startOfWeek(firstOfMonth(visibleMonth));
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + TRAINING_DATA_CONFIG.calendarGridDayCount - 1);
    gridEnd.setHours(23, 59, 59, 999);
    return { gridStart, gridEnd };
  }, [visibleMonth]);

  const sessions = useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, dateKey(range.gridStart), dateKey(range.gridEnd)],
    queryFn: async () => {
      const filters = {
        planned_from: range.gridStart.toISOString(),
        planned_to: range.gridEnd.toISOString(),
      };
      const pageSize = TRAINING_DATA_CONFIG.calendarApiPageLimit;
      const calendarLimit = TRAINING_DATA_CONFIG.calendarSessionLimit;
      const first = await listSessions({ ...filters, limit: pageSize, offset: 0 });
      const data = [...first.data];
      // Preserve the calendar's 200-session coverage without exceeding the
      // sessions endpoint's per-request pagination limit.
      while (data.length < first.total && data.length < calendarLimit) {
        const remaining = Math.min(pageSize, calendarLimit - data.length);
        const next = await listSessions({
          ...filters,
          limit: remaining,
          offset: data.length,
        });
        if (next.data.length === 0) {
          break;
        }
        data.push(...next.data);
      }
      return { ...first, data, limit: calendarLimit };
    },
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

  const loadedSessions = useMemo(() => sessions.data?.data ?? [], [sessions.data]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionListItem[]>();
    for (const session of loadedSessions) {
      const key = dateKey(session.planned_at);
      const current = map.get(key) ?? [];
      current.push(session);
      map.set(key, current);
    }
    for (const daySessions of map.values()) {
      daySessions.sort(
        (a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime(),
      );
    }
    return map;
  }, [loadedSessions]);

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

  /** Days on screen, in order: the month grid, the selected week, or the selected day. */
  const visibleDays = useMemo(() => {
    if (view === "day") {
      return [dateKey(selectedDate)];
    }
    const start = view === "week" ? startOfWeek(selectedDate) : range.gridStart;
    const count = view === "week" ? 7 : TRAINING_DATA_CONFIG.calendarGridDayCount;
    return Array.from({ length: count }, (_, index) => dateKey(addDays(start, index)));
  }, [range.gridStart, selectedDate, view]);

  /** Hours shown by the week and day views: the default range, widened to fit every session. */
  const visibleHours = useMemo(() => {
    let first: number = TRAINING_DATA_CONFIG.calendarDayStartHour;
    let last: number = TRAINING_DATA_CONFIG.calendarDayEndHour;
    for (const day of visibleDays) {
      for (const session of sessionsByDay.get(day) ?? []) {
        const start = new Date(session.planned_at);
        // The last minute of the session; a session ending at 20:00 does not need the 20:00 row.
        const lastMinute = new Date(sessionEnd(session.planned_at, durationOf(session)));
        lastMinute.setMinutes(lastMinute.getMinutes() - 1);
        first = Math.min(first, start.getHours());
        last = Math.max(last, dateKey(lastMinute) === day ? lastMinute.getHours() : 23);
      }
    }
    return Array.from({ length: last - first + 1 }, (_, index) => first + index);
  }, [sessionsByDay, visibleDays]);

  const selectedSessions = sessionsByDay.get(dateKey(selectedDate)) ?? [];
  const history = [...loadedSessions]
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
  const weeklyPlan = [...loadedSessions]
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

  // Formatters are built once per language: the time grid formats every chip on each
  // render, and a drag re-renders the grid whenever the pointer reaches a new slot.
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }),
    [i18n.language],
  );
  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }),
    [i18n.language],
  );

  const formatTime = (value: string) => timeFormat.format(new Date(value));

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const moveYear = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1));
  };

  /** Selects a day and loads the month that contains it. */
  const selectDay = useCallback((date: Date) => {
    setSelectedDate(date);
    setVisibleMonth((current) =>
      current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth()
        ? current
        : firstOfMonth(date),
    );
  }, []);

  const onMoved = useCallback(
    (plannedAt: string) => {
      const target = new Date(plannedAt);
      if (view === "month") {
        // Stay on the visible month when the session lands on one of its outside days.
        setSelectedDate(target);
        if (target < range.gridStart || target > range.gridEnd) {
          setVisibleMonth(firstOfMonth(target));
        }
        return;
      }
      selectDay(target);
    },
    [range.gridEnd, range.gridStart, selectDay, view],
  );

  const moveHintId = useId();
  const resizeHintId = useId();
  const scheduling = useCalendarScheduling({
    loadedSessions,
    granularity: view === "month" ? "day" : "hour",
    visibleDays,
    onMoved,
  });
  const { sessionTitle, highlightedConflicts } = scheduling;

  /** Start and end of a session, e.g. "18:00–19:30"; follows a pending resize. */
  const formatTimeRange = (session: SessionListItem) =>
    timeFormat.formatRange(
      new Date(session.planned_at),
      new Date(sessionEnd(session.planned_at, scheduling.displayedDuration(session))),
    );

  const formatDateTimeRange = (session: SessionListItem) =>
    `${dayFormat.format(new Date(session.planned_at))}, ${formatTimeRange(session)}`;

  const exerciseCount = (session: SessionListItem) =>
    t("homeSurface.session.exercises", {
      count: session.exercise_count,
    });

  const conflictLabelFor = (session: SessionListItem) =>
    highlightedConflicts.has(session.id) ? t("calendarSurface.schedule.conflictLabel") : undefined;

  const renderScheduleCard = (session: SessionListItem, meta: string, supporting: string) => {
    const movable = isReschedulable(session);
    return (
      <ScheduleSessionCard
        key={session.id}
        title={sessionTitle(session)}
        meta={meta}
        supporting={supporting}
        moveLabel={t("calendarSurface.schedule.moveLabel", { title: sessionTitle(session) })}
        moveHintId={moveHintId}
        handleProps={movable ? scheduling.handlePropsFor(session) : undefined}
        handleId={session.id}
        onMove={movable ? () => scheduling.openDialog(session) : undefined}
        conflictLabel={conflictLabelFor(session)}
        dragging={scheduling.isMoving(session)}
      />
    );
  };

  const startsInSlot = (session: SessionListItem, day: string, hour: number) =>
    dateKey(session.planned_at) === day && new Date(session.planned_at).getHours() === hour;

  /**
   * Sessions by the hour slots their planned time reaches into (week and day views),
   * using the pending length of a session being resized. Built once per change, so
   * a drag over the grid does not rescan every session for every slot.
   */
  const { pendingResize } = scheduling;
  const slotSessions = useMemo(() => {
    const map = new Map<string, SessionListItem[]>();
    if (view === "month") {
      return map;
    }
    const days = new Set(visibleDays);
    const byStart = [...loadedSessions].sort(
      (a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime(),
    );
    for (const session of byStart) {
      const length =
        pendingResize?.session.id === session.id ? pendingResize.durationMin : durationOf(session);
      for (const key of coveredSlotKeys(session.planned_at, length)) {
        if (days.has(key.slice(0, key.indexOf("T")))) {
          map.set(key, [...(map.get(key) ?? []), session]);
        }
      }
    }
    return map;
  }, [loadedSessions, pendingResize, view, visibleDays]);

  const sessionsInSlot = (day: string, hour: number) => slotSessions.get(slotKey(day, hour)) ?? [];

  const renderSlot = (day: string, hour: number) =>
    sessionsInSlot(day, hour).map((session) => {
      if (!startsInSlot(session, day, hour)) {
        return (
          <ScheduleSessionContinuation
            key={session.id}
            status={statusFor([session])}
            conflict={highlightedConflicts.has(session.id)}
          />
        );
      }
      const movable = isReschedulable(session);
      const time = formatTimeRange(session);
      const title = sessionTitle(session);
      return (
        <ScheduleSessionChip
          key={session.id}
          time={time}
          title={title}
          status={statusFor([session])}
          moveLabel={t("calendarSurface.schedule.chipLabel", { time, title })}
          moveHintId={moveHintId}
          handleProps={movable ? scheduling.handlePropsFor(session) : undefined}
          handleId={session.id}
          onMove={movable ? () => scheduling.openDialog(session) : undefined}
          resizeLabel={t("calendarSurface.schedule.resizeLabel", {
            title,
            time: formatTime(sessionEnd(session.planned_at, scheduling.displayedDuration(session))),
          })}
          resizeHintId={resizeHintId}
          resizeHandleProps={movable ? scheduling.resizeHandlePropsFor(session) : undefined}
          conflictLabel={conflictLabelFor(session)}
          moving={scheduling.isMoving(session)}
          resizing={scheduling.isResizing(session)}
        />
      );
    });

  const slotState = (day: string, hour: number) => ({
    dropTarget: scheduling.isDropTarget(slotKey(day, hour)),
    conflict: sessionsInSlot(day, hour).some((session) => highlightedConflicts.has(session.id)),
  });

  const shiftPeriod = (direction: -1 | 1) => {
    selectDay(addDays(selectedDate, direction * (view === "week" ? 7 : 1)));
  };

  const periodLabel = () => {
    if (view === "day") {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(selectedDate);
    }
    const start = dayFromKey(visibleDays[0]);
    const end = dayFromKey(visibleDays[visibleDays.length - 1]);
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).formatRange(start, end);
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
              <Button variant="secondary" size="sm" onClick={() => setManagePlansOpen(true)}>
                {t("trainingPlans.actions.manage")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditorAction("plan")}>
                {t("calendarSurface.actions.plan")}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setEditorAction("start")}>
                {t("calendarSurface.actions.start")}
              </Button>
            </>
          }
        >
          <CalendarViewSwitch
            view={view}
            onChange={setView}
            label={t("calendarSurface.views.label")}
            viewLabel={(option) => t(`calendarSurface.views.${option}`)}
          />

          {view === "month" ? (
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
          ) : (
            <div className="calendar-month__heading">
              <div className="calendar-month__nav">
                <IconButton
                  icon={<ChevronLeft />}
                  label={t(
                    view === "week"
                      ? "calendarSurface.navigation.previousWeek"
                      : "calendarSurface.navigation.previousDay",
                  )}
                  size="sm"
                  onClick={() => shiftPeriod(-1)}
                />
                <strong>{periodLabel()}</strong>
                <IconButton
                  icon={<ChevronRight />}
                  label={t(
                    view === "week"
                      ? "calendarSurface.navigation.nextWeek"
                      : "calendarSurface.navigation.nextDay",
                  )}
                  size="sm"
                  onClick={() => shiftPeriod(1)}
                />
              </div>
            </div>
          )}

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

          {view === "month" ? (
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
                    const key = dateKey(date);
                    const daySessions = sessionsByDay.get(key) ?? [];
                    const outside = date.getMonth() !== visibleMonth.getMonth();
                    const selected = key === dateKey(selectedDate);
                    const dayStatus = statusFor(daySessions);
                    const hasConflict = daySessions.some((session) =>
                      highlightedConflicts.has(session.id),
                    );

                    return (
                      <div
                        key={date.toISOString()}
                        className={[
                          "calendar-month__cell",
                          outside ? "calendar-month__cell--outside" : "",
                          selected ? "calendar-month__selected" : "",
                          daySessions.length > 0 ? `calendar-month__cell--${dayStatus}` : "",
                          scheduling.isDropTarget(key) ? "calendar-month__cell--drop-target" : "",
                          hasConflict ? "calendar-month__cell--conflict" : "",
                        ].join(" ")}
                        role="gridcell"
                        aria-selected={selected}
                        data-status={dayStatus}
                        {...{ [SCHEDULE_DROP_ATTRIBUTE]: key }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${String(date.getDate()).padStart(2, "0")} — ${t(
                            "calendarSurface.dayLabel",
                            {
                              date: new Intl.DateTimeFormat(i18n.language, {
                                dateStyle: "full",
                              }).format(date),
                              count: daySessions.length,
                            },
                          )}`}
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
          ) : (
            <ScheduleTimeGrid
              days={visibleDays}
              hours={visibleHours}
              label={t(
                view === "week"
                  ? "calendarSurface.timeGrid.weekLabel"
                  : "calendarSurface.timeGrid.dayLabel",
              )}
              timeHeading={t("calendarSurface.timeGrid.timeHeading")}
              dayHeading={(day) => {
                const date = dayFromKey(day);
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={day === dateKey(selectedDate)}
                    onClick={() => setSelectedDate(date)}
                  >
                    {new Intl.DateTimeFormat(i18n.language, {
                      weekday: "short",
                      day: "numeric",
                    }).format(date)}
                  </Button>
                );
              }}
              hourLabel={(hour) =>
                new Intl.DateTimeFormat(i18n.language, {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(2000, 0, 1, hour))
              }
              renderSlot={renderSlot}
              slotState={slotState}
              dropTargetAttribute={SCHEDULE_DROP_ATTRIBUTE}
            />
          )}

          <p id={moveHintId} className="sr-only">
            {t("calendarSurface.schedule.moveHint")}
          </p>
          <p id={resizeHintId} className="sr-only">
            {t("calendarSurface.schedule.resizeHint")}
          </p>
          {/* Persistent live region: move outcomes and conflicts are announced
              without moving focus (WCAG 4.1.3). */}
          <div role="status" aria-live="polite">
            {scheduling.feedback ? (
              <FormFeedback tone={scheduling.feedback.tone} role="presentation">
                {scheduling.feedback.message}
              </FormFeedback>
            ) : null}
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
              selectedSessions.map((session) =>
                renderScheduleCard(session, formatTimeRange(session), exerciseCount(session)),
              )
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
                      count: session.exercise_count,
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
              weeklyPlan.map((session) =>
                renderScheduleCard(
                  session,
                  formatDateTimeRange(session),
                  session.notes || exerciseCount(session),
                ),
              )
            )}
          </div>
        </TrainingPanel>
      </div>

      {scheduling.dragPreview ? (
        <ScheduleDragPreview
          title={sessionTitle(scheduling.dragPreview.item)}
          previewRef={scheduling.dragPreview.ref}
        />
      ) : null}

      {scheduling.dialogSession ? (
        <RescheduleSessionDialog
          key={scheduling.dialogSession.id}
          sessionTitle={sessionTitle(scheduling.dialogSession)}
          plannedAt={scheduling.dialogSession.planned_at}
          durationMin={durationOf(scheduling.dialogSession)}
          onCancel={scheduling.closeDialog}
          onConfirm={scheduling.confirmDialogChange}
        />
      ) : null}

      <PlanManagement open={managePlansOpen} onClose={() => setManagePlansOpen(false)} />

      <WorkoutEditor
        open={editorAction !== null}
        onClose={() => setEditorAction(null)}
        plannedAt={selectedDayStart.toISOString()}
        actions={editorAction ? [editorAction] : []}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
        }}
      />
    </main>
  );
};

export default CalendarPage;
