import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionListItem } from "../services/sessionApi";
import {
  SCHEDULE_HANDLE_ATTRIBUTE,
  type ScheduleHandleProps,
} from "../lib/scheduling/scheduleHandle";
import {
  findScheduleConflicts,
  isScheduleStepKey,
  plannedAtForTarget,
  stepScheduleTarget,
  targetKeyFor,
  type ScheduleGranularity,
} from "../lib/scheduling/sessionSchedule";
import { usePointerDrag } from "./usePointerDrag";
import { useKeyboardMove, type KeyboardMoveEvent } from "./useKeyboardMove";
import { useSessionReschedule, type RescheduleResult } from "./useSessionReschedule";

/** Attribute that marks a calendar day or hour slot as a drop target; its value is the target key. */
export const SCHEDULE_DROP_ATTRIBUTE = "data-schedule-day";

export interface ScheduleFeedback {
  tone: "info" | "success" | "warning";
  message: string;
}

export interface CalendarSchedulingOptions {
  loadedSessions: readonly SessionListItem[];
  /** Day targets in the month view, hour slots in the week and day views. */
  granularity: ScheduleGranularity;
  /** Day keys currently on screen, in order; keyboard moves stay inside them. */
  visibleDays: readonly string[];
  /** Called after a move is saved, so the page can follow the session. */
  onMoved: (plannedAt: string) => void;
}

/**
 * Everything the Calendar needs to move planned sessions: pointer drag,
 * keyboard pick-up, the move dialog, conflict preview, saving, announcements
 * and returning focus to the moved session's handle. The page only renders.
 */
export function useCalendarScheduling({
  loadedSessions,
  granularity,
  visibleDays,
  onMoved,
}: CalendarSchedulingOptions) {
  const { t, i18n } = useTranslation();
  const { reschedule } = useSessionReschedule(loadedSessions);
  const [feedback, setFeedback] = useState<ScheduleFeedback | null>(null);
  const [conflictIds, setConflictIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dialogSession, setDialogSession] = useState<SessionListItem | null>(null);
  const [refocusId, setRefocusId] = useState<string | null>(null);

  const sessionTitle = useCallback(
    (session: SessionListItem) => session.title || t("homeSurface.session.workout"),
    [t],
  );

  const formatInstant = useCallback(
    (value: string, withTime = true) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: withTime ? "medium" : "full",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(new Date(value)),
    [i18n.language],
  );

  const conflictMessage = useCallback(
    (result: Extract<RescheduleResult, { status: "conflict" }>) => {
      const blocking = loadedSessions.find((session) => result.conflictingIds.includes(session.id));
      const instant = new Date(result.plannedAt);
      const when = {
        date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(instant),
        time: new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(instant),
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
        setConflictIds(new Set());
        onMoved(result.plannedAt);
        setFeedback({
          tone: "success",
          message: t("calendarSurface.schedule.status.moved", {
            title: sessionTitle(session),
            date: formatInstant(result.plannedAt),
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
    [conflictMessage, formatInstant, onMoved, reschedule, sessionTitle, t],
  );

  /** Moves a session onto a day or hour-slot target; resolves once the outcome is shown. */
  const dropOnTarget = useCallback(
    async (session: SessionListItem, targetKey: string): Promise<void> => {
      const plannedAt = plannedAtForTarget(session.planned_at, targetKey);
      if (!plannedAt) {
        setFeedback({ tone: "warning", message: t("calendarSurface.schedule.errors.invalid") });
        return;
      }
      if (new Date(plannedAt).getTime() === new Date(session.planned_at).getTime()) {
        return;
      }
      const refusal = await performMove(session, plannedAt);
      if (refusal) {
        setFeedback({ tone: "warning", message: refusal });
      }
    },
    [performMove, t],
  );

  const pointer = usePointerDrag<SessionListItem>({
    dropTargetAttribute: SCHEDULE_DROP_ATTRIBUTE,
    onDrop: (session, targetKey) => void dropOnTarget(session, targetKey),
  });

  const conflictsAt = useCallback(
    (session: SessionListItem, targetKey: string): SessionListItem[] => {
      const plannedAt = plannedAtForTarget(session.planned_at, targetKey);
      return plannedAt ? findScheduleConflicts(loadedSessions, session.id, plannedAt) : [];
    },
    [loadedSessions],
  );

  const announceKeyboard = useCallback(
    (event: KeyboardMoveEvent, session: SessionListItem, targetKey: string) => {
      const title = sessionTitle(session);
      if (event === "pickup") {
        setFeedback({
          tone: "info",
          message: t("calendarSurface.schedule.keyboard.pickedUp", { title }),
        });
      } else if (event === "cancel") {
        setFeedback({
          tone: "info",
          message: t("calendarSurface.schedule.keyboard.cancelled", { title }),
        });
      } else if (event === "move") {
        const plannedAt = plannedAtForTarget(session.planned_at, targetKey);
        if (!plannedAt) {
          return;
        }
        const target = formatInstant(plannedAt, granularity === "hour");
        const [blocking] = conflictsAt(session, targetKey);
        setFeedback(
          blocking
            ? {
                tone: "warning",
                message: t("calendarSurface.schedule.keyboard.overConflict", {
                  target,
                  title: sessionTitle(blocking),
                }),
              }
            : { tone: "info", message: t("calendarSurface.schedule.keyboard.over", { target }) },
        );
      }
    },
    [conflictsAt, formatInstant, granularity, sessionTitle, t],
  );

  const keyboard = useKeyboardMove<SessionListItem>({
    initialTarget: (session) => targetKeyFor(session.planned_at, granularity),
    step: (target, key) =>
      isScheduleStepKey(key) ? stepScheduleTarget(target, key, visibleDays) : null,
    // The moved session may render in another slot (optimistic update, or a rollback
    // after a refusal); focus returns to its handle once that outcome is on screen.
    onDrop: (session, targetKey) => {
      void dropOnTarget(session, targetKey).then(() => setRefocusId(session.id));
    },
    onEvent: announceKeyboard,
  });

  // Return focus to the moved session's handle so keyboard users keep their place.
  useEffect(() => {
    if (!refocusId) {
      return;
    }
    const handle = document.querySelector<HTMLElement>(
      `[${SCHEDULE_HANDLE_ATTRIBUTE}="${CSS.escape(refocusId)}"]`,
    );
    if (handle) {
      handle.focus();
      setRefocusId(null);
    }
  }, [loadedSessions, refocusId]);

  /** The pending move, from either a pointer drag or a keyboard pick-up. */
  const activeMove = pointer.dragState ?? keyboard.moveState;

  // While a move is pending, conflicts are previewed for its target before anything is saved.
  const highlightedConflicts = useMemo<ReadonlySet<string>>(() => {
    if (!activeMove) {
      return conflictIds;
    }
    if (!activeMove.overTarget) {
      return new Set();
    }
    return new Set(conflictsAt(activeMove.item, activeMove.overTarget).map(({ id }) => id));
  }, [activeMove, conflictIds, conflictsAt]);

  const handlePropsFor = useCallback(
    (session: SessionListItem): ScheduleHandleProps => ({
      ...pointer.getHandleProps(session),
      ...keyboard.getKeyHandlers(session),
    }),
    [keyboard, pointer],
  );

  const confirmDialogMove = useCallback(
    async (plannedAt: string) => {
      if (!dialogSession) {
        return null;
      }
      const refusal = await performMove(dialogSession, plannedAt);
      if (!refusal) {
        setDialogSession(null);
      }
      return refusal;
    },
    [dialogSession, performMove],
  );

  return {
    feedback,
    sessionTitle,
    activeMove,
    isMoving: (session: SessionListItem) => activeMove?.item.id === session.id,
    isDropTarget: (targetKey: string) => activeMove?.overTarget === targetKey,
    highlightedConflicts,
    handlePropsFor,
    dialogSession,
    openDialog: setDialogSession,
    closeDialog: () => setDialogSession(null),
    confirmDialogMove,
    dragPreview: pointer.dragState
      ? { item: pointer.dragState.item, ref: pointer.previewRef }
      : null,
  };
}
