import type { Session } from "../../services/sessionApi";

/**
 * Pure scheduling rules shared by every planner surface (calendar, dialogs, hooks).
 * All day arithmetic uses the viewer's local calendar, matching how the calendar
 * groups sessions into days.
 */

type SchedulableSession = Pick<Session, "id" | "planned_at" | "status" | "deleted_at">;

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar day of an instant as `YYYY-MM-DD`. */
export const localDateKey = (value: Date | string): string => {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Local time of day of an instant as `HH:MM`, the value format of a time input. */
export const localTimeKey = (value: Date | string): string => {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * Combines a local day (`YYYY-MM-DD`) and time (`HH:MM`) into an ISO instant.
 * Returns null for malformed input and for local times that do not exist
 * (for example inside a daylight-saving gap), instead of silently shifting them.
 */
export const localDateTimeToIso = (dayKey: string, timeKey: string): string | null => {
  const day = DAY_KEY_PATTERN.exec(dayKey);
  const time = TIME_KEY_PATTERN.exec(timeKey);
  if (!day || !time) {
    return null;
  }
  const [year, month, date] = [Number(day[1]), Number(day[2]), Number(day[3])];
  const [hours, minutes] = [Number(time[1]), Number(time[2])];
  const value = new Date(year, month - 1, date, hours, minutes, 0, 0);
  const exists =
    value.getFullYear() === year &&
    value.getMonth() === month - 1 &&
    value.getDate() === date &&
    value.getHours() === hours &&
    value.getMinutes() === minutes;
  return exists ? value.toISOString() : null;
};

/** Moves an instant to another local day while keeping its local time of day. */
export const moveToLocalDay = (plannedAt: string, dayKey: string): string | null =>
  localDateTimeToIso(dayKey, localTimeKey(plannedAt));

/**
 * Schedule targets are what a move lands on, as a string key:
 * - a day, `YYYY-MM-DD` (month view): the session keeps its local time;
 * - an hour slot, `YYYY-MM-DDTHH` (week and day views): the session takes that
 *   hour and keeps its minutes.
 */
const SLOT_KEY_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2})$/;

export type ScheduleGranularity = "day" | "hour";

export const slotKey = (dayKey: string, hour: number): string => `${dayKey}T${pad(hour)}`;

const parseTarget = (targetKey: string): { day: string; hour: number | null } | null => {
  const slot = SLOT_KEY_PATTERN.exec(targetKey);
  if (slot) {
    const hour = Number(slot[2]);
    return hour <= 23 ? { day: slot[1], hour } : null;
  }
  return DAY_KEY_PATTERN.test(targetKey) ? { day: targetKey, hour: null } : null;
};

/** The target key a session currently occupies at the given granularity. */
export const targetKeyFor = (plannedAt: string, granularity: ScheduleGranularity): string =>
  granularity === "day"
    ? localDateKey(plannedAt)
    : slotKey(localDateKey(plannedAt), new Date(plannedAt).getHours());

/** The instant a session moves to when dropped on a day or hour-slot target. */
export const plannedAtForTarget = (plannedAt: string, targetKey: string): string | null => {
  const target = parseTarget(targetKey);
  if (!target) {
    return null;
  }
  if (target.hour === null) {
    return moveToLocalDay(plannedAt, target.day);
  }
  return localDateTimeToIso(
    target.day,
    `${pad(target.hour)}:${pad(new Date(plannedAt).getMinutes())}`,
  );
};

export type ScheduleStepKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export const isScheduleStepKey = (key: string): key is ScheduleStepKey =>
  key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";

/**
 * Keyboard stepping between targets, kept inside the days currently shown.
 * Day targets: left/right move one day, up/down one week (the month grid's rows).
 * Hour slots: left/right move one day, up/down one hour within that day.
 * Returns the unchanged key at a boundary.
 */
export const stepScheduleTarget = (
  targetKey: string,
  key: ScheduleStepKey,
  visibleDays: readonly string[],
): string => {
  const target = parseTarget(targetKey);
  const dayIndex = target ? visibleDays.indexOf(target.day) : -1;
  if (!target || dayIndex < 0) {
    return targetKey;
  }
  const horizontal = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
  const vertical = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;

  if (target.hour === null) {
    const nextIndex = dayIndex + horizontal + vertical * 7;
    return visibleDays[nextIndex] ?? targetKey;
  }
  if (horizontal !== 0) {
    const nextDay = visibleDays[dayIndex + horizontal];
    return nextDay ? slotKey(nextDay, target.hour) : targetKey;
  }
  const nextHour = target.hour + vertical;
  return nextHour >= 0 && nextHour <= 23 ? slotKey(target.day, nextHour) : targetKey;
};

/**
 * Only planned workouts are moved by the planner. Completed records must be reopened
 * before correction (server rule), and in-progress workouts are being performed.
 */
export const isReschedulable = (session: Pick<Session, "status" | "deleted_at">): boolean =>
  session.status === "planned" && !session.deleted_at;

/**
 * Sessions that would conflict with `sessionId` planned at `plannedAt`.
 * A conflict is another active session at the same instant: the same rule the
 * server enforces. Duration-based overlap is not inferred on either side.
 */
export const findScheduleConflicts = <T extends SchedulableSession>(
  sessions: readonly T[],
  sessionId: string,
  plannedAt: string,
): T[] => {
  const target = new Date(plannedAt).getTime();
  return sessions.filter(
    (session) =>
      session.id !== sessionId &&
      session.status !== "canceled" &&
      !session.deleted_at &&
      new Date(session.planned_at).getTime() === target,
  );
};
