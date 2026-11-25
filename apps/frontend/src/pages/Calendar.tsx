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
import { FormFeedback, type FeedbackTone } from "../components/composites/FormStack";
import ScheduleSessionCard, {
  ScheduleDragPreview,
} from "../components/composites/ScheduleSessionCard";
import RescheduleSessionDialog from "../components/composites/RescheduleSessionDialog";
import { usePointerDrag } from "../hooks/usePointerDrag";
import {
  CALENDAR_QUERY_KEY,
  useSessionReschedule,
  type RescheduleResult,
} from "../hooks/useSessionReschedule";
import {
  findScheduleConflicts,
  isReschedulable,
  localDateKey as dateKey,
  moveToLocalDay,
} from "../lib/scheduling/sessionSchedule";

/** Attribute that marks a calendar day cell as a drop target; its value is the day key. */
const DROP_DAY_ATTRIBUTE = "data-schedule-day";

type ScheduleFeedback = { tone: FeedbackTone; message: string };

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

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionListItem[]>();
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

  const formatDateTime = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    [i18n.language],
  );

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const moveYear = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear() + delta, current.getMonth(), 1));
  };

  const loadedSessions = useMemo(() => sessions.data?.data ?? [], [sessions.data]);
  const { reschedule } = useSessionReschedule(loadedSessions);
  const moveHintId = useId();
  const [movingSession, setMovingSession] = useState<SessionListItem | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<ScheduleFeedback | null>(null);
  const [conflictIds, setConflictIds] = useState<ReadonlySet<string>>(() => new Set());

  const sessionTitle = useCallback(
    (session: SessionListItem) => session.title || t("homeSurface.session.workout"),
    [t],
  );

  const conflictMessage = useCallback(
    (result: Extract<RescheduleResult, { status: "conflict" }>) => {
      const blocking = loadedSessions.find((session) => result.conflictingIds.includes(session.id));
      const when = {
        date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
          new Date(result.plannedAt),
        ),
        time: new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(
          new Date(result.plannedAt),
        ),
      };
      return blocking
        ? t("calendarSurface.schedule.errors.conflict", { ...when, title: sessionTitle(blocking) })
        : t("calendarSurface.schedule.errors.conflictUnlisted", when);
    },
    [i18n.language, loadedSessions, sessionTitle, t],
  );

  /** Saves a move and resolves to the refusal message, or null when it was saved. */
  const performMove = useCallback(
    async (session: SessionListItem, plannedAt: string): Promise<string | null> => {
      const result = await reschedule(session, plannedAt);
      if (result.status === "saved") {
        const target = new Date(result.plannedAt);
        setConflictIds(new Set());
        setSelectedDate(target);
        if (target < range.gridStart || target > range.gridEnd) {
          setVisibleMonth(new Date(target.getFullYear(), target.getMonth(), 1));
        }
        setScheduleFeedback({
          tone: "success",
          message: t("calendarSurface.schedule.status.moved", {
            title: sessionTitle(session),
            date: formatDateTime(result.plannedAt),
          }),
        });
        return null;
      }
      if (result.status === "conflict") {
        setConflictIds(new Set(result.conflictingIds));
        return conflictMessage(result);
      }
      return t("calendarSurface.schedule.errors.save");
    },
    [conflictMessage, formatDateTime, range.gridEnd, range.gridStart, reschedule, sessionTitle, t],
  );

  const dropOnDay = useCallback(
    (session: SessionListItem, dayKey: string) => {
      if (dayKey === dateKey(session.planned_at)) {
        return;
      }
      const plannedAt = moveToLocalDay(session.planned_at, dayKey);
      if (!plannedAt) {
        setScheduleFeedback({
          tone: "warning",
          message: t("calendarSurface.schedule.errors.invalid"),
        });
        return;
      }
      void performMove(session, plannedAt).then((refusal) => {
        if (refusal) {
          setScheduleFeedback({ tone: "warning", message: refusal });
        }
      });
    },
    [performMove, t],
  );

  const { dragState, getHandleProps, previewRef } = usePointerDrag<SessionListItem>({
    dropTargetAttribute: DROP_DAY_ATTRIBUTE,
    onDrop: dropOnDay,
  });

  // While dragging, conflicts are previewed for the hovered day before anything is saved.
  const hoverConflictIds = useMemo(() => {
    if (!dragState?.overTarget) {
      return new Set<string>();
    }
    const plannedAt = moveToLocalDay(dragState.item.planned_at, dragState.overTarget);
    return new Set(
      plannedAt
        ? findScheduleConflicts(loadedSessions, dragState.item.id, plannedAt).map(({ id }) => id)
        : [],
    );
  }, [dragState, loadedSessions]);

  const highlightedConflicts = dragState ? hoverConflictIds : conflictIds;

  const exerciseCount = (session: SessionListItem) =>
    t("homeSurface.session.exercises", {
      count: session.exercise_count,
    });

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
        handleProps={movable ? getHandleProps(session) : undefined}
        onMove={movable ? () => setMovingSession(session) : undefined}
        conflictLabel={
          highlightedConflicts.has(session.id)
            ? t("calendarSurface.schedule.conflictLabel")
            : undefined
        }
        dragging={dragState?.item.id === session.id}
      />
    );
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
                  const key = dateKey(date);
                  const daySessions = sessionsByDay.get(key) ?? [];
                  const outside = date.getMonth() !== visibleMonth.getMonth();
                  const selected = key === dateKey(selectedDate);
                  const dayStatus = statusFor(daySessions);
                  const dropTarget = dragState?.overTarget === key;
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
                        dropTarget ? "calendar-month__cell--drop-target" : "",
                        hasConflict ? "calendar-month__cell--conflict" : "",
                      ].join(" ")}
                      role="gridcell"
                      aria-selected={selected}
                      data-status={dayStatus}
                      {...{ [DROP_DAY_ATTRIBUTE]: key }}
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

          <p id={moveHintId} className="sr-only">
            {t("calendarSurface.schedule.moveHint")}
          </p>
          {/* Persistent live region: move outcomes and conflicts are announced
              without moving focus (WCAG 4.1.3). */}
          <div role="status" aria-live="polite">
            {scheduleFeedback ? (
              <FormFeedback tone={scheduleFeedback.tone} role="presentation">
                {scheduleFeedback.message}
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
                renderScheduleCard(
                  session,
                  new Intl.DateTimeFormat(i18n.language, {
                    timeStyle: "short",
                  }).format(new Date(session.planned_at)),
                  exerciseCount(session),
                ),
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
                  formatDateTime(session.planned_at),
                  session.notes || exerciseCount(session),
                ),
              )
            )}
          </div>
        </TrainingPanel>
      </div>

      {dragState ? (
        <ScheduleDragPreview title={sessionTitle(dragState.item)} previewRef={previewRef} />
      ) : null}

      {movingSession ? (
        <RescheduleSessionDialog
          key={movingSession.id}
          sessionTitle={sessionTitle(movingSession)}
          plannedAt={movingSession.planned_at}
          onCancel={() => setMovingSession(null)}
          onConfirm={async (plannedAt) => {
            const refusal = await performMove(movingSession, plannedAt);
            if (!refusal) {
              setMovingSession(null);
            }
            return refusal;
          }}
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
