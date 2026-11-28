import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionListItem } from "../services/sessionApi";
import {
  SCHEDULE_HANDLE_ATTRIBUTE,
  SCHEDULE_RESIZE_HANDLE_ATTRIBUTE,
  type ScheduleHandleProps,
} from "../lib/scheduling/scheduleHandle";
import {
  durationForSlotEnd,
  durationOf,
  findScheduleConflicts,
  isScheduleStepKey,
  plannedAtForTarget,
  sessionEnd,
  stepDuration,
  stepScheduleTarget,
  targetKeyFor,
  type ScheduleGranularity,
} from "../lib/scheduling/sessionSchedule";
import { usePointerDrag } from "./usePointerDrag";
import { useKeyboardMove, type KeyboardMoveEvent } from "./useKeyboardMove";
import {
  useSessionReschedule,
  type RescheduleResult,
  type SessionSchedule,
} from "./useSessionReschedule";

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
  /** Called after a change is saved, so the page can follow the session. */
  onMoved: (plannedAt: string) => void;
}

/** A pending change of a session's length, from a resize drag or the keyboard. */
export interface PendingResize {
  session: SessionListItem;
  durationMin: number;
}

interface Refocus {
  id: string;
  attribute: string;
}

const scheduleOf = (session: SessionListItem): SessionSchedule => ({
  plannedAt: session.planned_at,
  durationMin: durationOf(session),
});

/** A resize keeps the start and changes the length. */
const resizedSchedule = (session: SessionListItem, durationMin: number): SessionSchedule => ({
  plannedAt: session.planned_at,
  durationMin,
});

/** A move keeps the length and takes the target's start. */
const movedSchedule = (session: SessionListItem, targetKey: string): SessionSchedule | null => {
  const plannedAt = plannedAtForTarget(session.planned_at, targetKey);
  return plannedAt ? { plannedAt, durationMin: durationOf(session) } : null;
};

/**
 * Everything the Calendar needs to move and resize planned sessions: pointer
 * drag, keyboard pick-up, the reschedule dialog, overlap preview, saving,
 * announcements and returning focus to the handle that was used. The page only
 * renders.
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
  const [refocus, setRefocus] = useState<Refocus | null>(null);

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

  const formatDate = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value)),
    [i18n.language],
  );

  const formatTime = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" }).format(new Date(value)),
    [i18n.language],
  );

  const formatMinutes = useCallback(
    (minutes: number) =>
      new Intl.NumberFormat(i18n.language, {
        style: "unit",
        unit: "minute",
        unitDisplay: "long",
      }).format(minutes),
    [i18n.language],
  );

  /** Day, start and end of a schedule, for messages. */
  const describe = useCallback(
    ({ plannedAt, durationMin }: SessionSchedule) => ({
      date: formatDate(plannedAt),
      start: formatTime(plannedAt),
      end: formatTime(sessionEnd(plannedAt, durationMin)),
    }),
    [formatDate, formatTime],
  );

  const conflictMessage = useCallback(
    (result: Extract<RescheduleResult, { status: "conflict" }>) => {
      const blocking = loadedSessions.find((session) => result.conflictingIds.includes(session.id));
      return blocking
        ? t("calendarSurface.schedule.errors.conflict", {
            ...describe(scheduleOf(blocking)),
            title: sessionTitle(blocking),
          })
        : t("calendarSurface.schedule.errors.conflictUnlisted", describe(result));
    },
    [describe, loadedSessions, sessionTitle, t],
  );

  /** Saves a new start and length; resolves to the refusal message, or null when saved. */
  const performChange = useCallback(
    async (session: SessionListItem, schedule: SessionSchedule): Promise<string | null> => {
      const result = await reschedule(session, schedule);
      if (result.status === "saved") {
        setConflictIds(new Set());
        onMoved(result.plannedAt);
        setFeedback({
          tone: "success",
          message: t("calendarSurface.schedule.status.rescheduled", {
            ...describe(result),
            title: sessionTitle(session),
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
    [conflictMessage, describe, onMoved, reschedule, sessionTitle, t],
  );

  /** Saves a change unless it changes nothing; refusals are shown as feedback. */
  const applyChange = useCallback(
    async (session: SessionListItem, schedule: SessionSchedule | null): Promise<void> => {
      if (!schedule) {
        setFeedback({ tone: "warning", message: t("calendarSurface.schedule.errors.invalid") });
        return;
      }
      const unchanged =
        new Date(schedule.plannedAt).getTime() === new Date(session.planned_at).getTime() &&
        schedule.durationMin === durationOf(session);
      if (unchanged) {
        return;
      }
      const refusal = await performChange(session, schedule);
      if (refusal) {
        setFeedback({ tone: "warning", message: refusal });
      }
    },
    [performChange, t],
  );

  // ----- Moving: the session keeps its length and takes a new start. -----

  const dropOnTarget = useCallback(
    (session: SessionListItem, targetKey: string) =>
      applyChange(session, movedSchedule(session, targetKey)),
    [applyChange],
  );

  const conflictsFor = useCallback(
    (session: SessionListItem, schedule: SessionSchedule | null): SessionListItem[] =>
      schedule
        ? findScheduleConflicts(
            loadedSessions,
            session.id,
            schedule.plannedAt,
            schedule.durationMin,
          )
        : [],
    [loadedSessions],
  );

  const pointer = usePointerDrag<SessionListItem>({
    dropTargetAttribute: SCHEDULE_DROP_ATTRIBUTE,
    onDrop: (session, targetKey) => void dropOnTarget(session, targetKey),
  });

  const announce = useCallback(
    (tone: ScheduleFeedback["tone"], key: string, values: Record<string, string>) =>
      setFeedback({ tone, message: t(`calendarSurface.schedule.keyboard.${key}`, values) }),
    [t],
  );

  const announceMove = useCallback(
    (event: KeyboardMoveEvent, session: SessionListItem, targetKey: string) => {
      const title = sessionTitle(session);
      if (event === "pickup") {
        announce("info", "pickedUp", { title });
      } else if (event === "cancel") {
        announce("info", "cancelled", { title });
      } else if (event === "move") {
        const schedule = movedSchedule(session, targetKey);
        if (!schedule) {
          return;
        }
        const target = formatInstant(schedule.plannedAt, granularity === "hour");
        const [blocking] = conflictsFor(session, schedule);
        if (blocking) {
          announce("warning", "overConflict", { target, title: sessionTitle(blocking) });
        } else {
          announce("info", "over", { target });
        }
      }
    },
    [announce, conflictsFor, formatInstant, granularity, sessionTitle],
  );

  const keyboard = useKeyboardMove<SessionListItem>({
    initialTarget: (session) => targetKeyFor(session.planned_at, granularity),
    step: (target, key) =>
      isScheduleStepKey(key) ? stepScheduleTarget(target, key, visibleDays) : null,
    // The moved session may render in another slot (optimistic update, or a rollback
    // after a refusal); focus returns to its handle once that outcome is on screen.
    onDrop: (session, targetKey) => {
      void dropOnTarget(session, targetKey).then(() =>
        setRefocus({ id: session.id, attribute: SCHEDULE_HANDLE_ATTRIBUTE }),
      );
    },
    onEvent: announceMove,
  });

  // ----- Resizing: the session keeps its start and gets a new end. -----

  const resizePointer = usePointerDrag<SessionListItem>({
    dropTargetAttribute: SCHEDULE_DROP_ATTRIBUTE,
    onDrop: (session, targetKey) => {
      const durationMin = durationForSlotEnd(session.planned_at, targetKey);
      void applyChange(
        session,
        durationMin === null ? null : resizedSchedule(session, durationMin),
      );
    },
  });

  const announceResize = useCallback(
    (event: KeyboardMoveEvent, session: SessionListItem, target: string) => {
      const title = sessionTitle(session);
      if (event === "pickup") {
        announce("info", "resizePickedUp", { title });
      } else if (event === "cancel") {
        announce("info", "resizeCancelled", { title });
      } else if (event === "move") {
        const durationMin = Number(target);
        const values = {
          time: formatTime(sessionEnd(session.planned_at, durationMin)),
          duration: formatMinutes(durationMin),
        };
        const [blocking] = conflictsFor(session, resizedSchedule(session, durationMin));
        if (blocking) {
          announce("warning", "resizeOverConflict", { ...values, title: sessionTitle(blocking) });
        } else {
          announce("info", "resizeOver", values);
        }
      }
    },
    [announce, conflictsFor, formatMinutes, formatTime, sessionTitle],
  );

  const resizeKeyboard = useKeyboardMove<SessionListItem>({
    initialTarget: (session) => String(durationOf(session)),
    step: (target, key) => {
      const next = stepDuration(Number(target), key);
      return next === null ? null : String(next);
    },
    onDrop: (session, target) => {
      void applyChange(session, resizedSchedule(session, Number(target))).then(() =>
        setRefocus({ id: session.id, attribute: SCHEDULE_RESIZE_HANDLE_ATTRIBUTE }),
      );
    },
    onEvent: announceResize,
  });

  // Return focus to the handle that was used, so keyboard users keep their place.
  useEffect(() => {
    if (!refocus) {
      return;
    }
    const handle = document.querySelector<HTMLElement>(
      `[${refocus.attribute}="${CSS.escape(refocus.id)}"]`,
    );
    if (handle) {
      handle.focus();
      setRefocus(null);
    }
  }, [loadedSessions, refocus]);

  /** The pending move, from either a pointer drag or a keyboard pick-up. */
  const activeMove = pointer.dragState ?? keyboard.moveState;

  /** The pending length change, from either a resize drag or the keyboard. */
  const pendingResize = useMemo<PendingResize | null>(() => {
    if (resizeKeyboard.moveState) {
      return {
        session: resizeKeyboard.moveState.item,
        durationMin: Number(resizeKeyboard.moveState.overTarget),
      };
    }
    const drag = resizePointer.dragState;
    if (!drag) {
      return null;
    }
    const durationMin = drag.overTarget
      ? durationForSlotEnd(drag.item.planned_at, drag.overTarget)
      : null;
    return { session: drag.item, durationMin: durationMin ?? durationOf(drag.item) };
  }, [resizeKeyboard.moveState, resizePointer.dragState]);

  // While a change is pending, overlaps are previewed before anything is saved.
  const highlightedConflicts = useMemo<ReadonlySet<string>>(() => {
    if (pendingResize) {
      return new Set(
        conflictsFor(
          pendingResize.session,
          resizedSchedule(pendingResize.session, pendingResize.durationMin),
        ).map(({ id }) => id),
      );
    }
    if (!activeMove) {
      return conflictIds;
    }
    if (!activeMove.overTarget) {
      return new Set();
    }
    return new Set(
      conflictsFor(activeMove.item, movedSchedule(activeMove.item, activeMove.overTarget)).map(
        ({ id }) => id,
      ),
    );
  }, [activeMove, conflictIds, conflictsFor, pendingResize]);

  const handlePropsFor = useCallback(
    (session: SessionListItem): ScheduleHandleProps => ({
      ...pointer.getHandleProps(session),
      ...keyboard.getKeyHandlers(session),
    }),
    [keyboard, pointer],
  );

  const resizeHandlePropsFor = useCallback(
    (session: SessionListItem): ScheduleHandleProps => ({
      ...resizePointer.getHandleProps(session),
      ...resizeKeyboard.getKeyHandlers(session),
    }),
    [resizeKeyboard, resizePointer],
  );

  const confirmDialogChange = useCallback(
    async (schedule: SessionSchedule) => {
      if (!dialogSession) {
        return null;
      }
      const refusal = await performChange(dialogSession, schedule);
      if (!refusal) {
        setDialogSession(null);
      }
      return refusal;
    },
    [dialogSession, performChange],
  );

  return {
    feedback,
    sessionTitle,
    activeMove,
    pendingResize,
    /** Length to show for a session: the pending one while it is being resized. */
    displayedDuration: (session: SessionListItem) =>
      pendingResize?.session.id === session.id ? pendingResize.durationMin : durationOf(session),
    isMoving: (session: SessionListItem) => activeMove?.item.id === session.id,
    isResizing: (session: SessionListItem) => pendingResize?.session.id === session.id,
    isDropTarget: (targetKey: string) =>
      activeMove?.overTarget === targetKey || resizePointer.dragState?.overTarget === targetKey,
    highlightedConflicts,
    handlePropsFor,
    resizeHandlePropsFor,
    dialogSession,
    openDialog: setDialogSession,
    closeDialog: () => setDialogSession(null),
    confirmDialogChange,
    dragPreview: pointer.dragState
      ? { item: pointer.dragState.item, ref: pointer.previewRef }
      : null,
  };
}
