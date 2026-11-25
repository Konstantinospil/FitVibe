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
