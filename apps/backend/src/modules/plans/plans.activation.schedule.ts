import { HttpError } from "../../utils/http.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface PlanTemplateDate {
  id: string;
  planned_at: string;
}

interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localTime(at: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const numeric = (part: Intl.DateTimeFormatPartTypes) => {
    const value = Number(parts.find(({ type }) => type === part)?.value);
    if (!Number.isInteger(value)) {
      throw new HttpError(422, "E.PLAN.INVALID_SCHEDULE", "Unable to resolve workout local time");
    }
    return value;
  };
  return {
    year: numeric("year"), month: numeric("month"), day: numeric("day"),
    hour: numeric("hour"), minute: numeric("minute"), second: numeric("second"),
  };
}

function localEpoch(parts: LocalTime, milliseconds: number): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second, milliseconds);
}

function localToUtc(target: number, timeZone: string): string {
  let guess = target;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const d = new Date(guess);
    const actual = localEpoch(localTime(d, timeZone), d.getUTCMilliseconds());
    const difference = target - actual;
    if (difference === 0) {
      return d.toISOString();
    }
    guess += difference;
  }
  throw new HttpError(422, "E.PLAN.NONEXISTENT_LOCAL_TIME",
    "The scheduled workout time does not exist in the configured timezone");
}

export function planEndDate(startDate: string, durationWeeks: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00.000Z`) + durationWeeks * WEEK_MS - DAY_MS)
    .toISOString().slice(0, 10);
}

/** Recurrence follows the template's local wall-clock time, even across DST. */
export function buildWeeklyOccurrences(
  startDate: string,
  durationWeeks: number,
  targetFrequency: number,
  templates: PlanTemplateDate[],
  timeZone = "UTC",
): Array<{ sourceId: string; plannedAt: string }> {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== startDate ||
    !Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 52 ||
    !Number.isInteger(targetFrequency) || targetFrequency < 1 || targetFrequency > 7 ||
    !validTimeZone(timeZone)
  ) {
    throw new HttpError(422, "E.PLAN.INVALID_SCHEDULE",
      "Invalid plan start date, duration, frequency or timezone");
  }
  if (templates.length !== targetFrequency) {
    throw new HttpError(422, "E.PLAN.TEMPLATE_MISMATCH",
      "The first week must contain exactly target_frequency planned sessions");
  }

  const seen = new Set<number>();
  const occurrences: Array<{ sourceId: string; plannedAt: string }> = [];
  for (const template of templates) {
    const at = new Date(template.planned_at);
    if (Number.isNaN(at.getTime()) || seen.has(at.getTime())) {
      throw new HttpError(422, "E.PLAN.INVALID_TEMPLATE", "Invalid or duplicate template time");
    }
    const wall = localTime(at, timeZone);
    const day = Date.UTC(wall.year, wall.month - 1, wall.day);
    if (day < start || day >= start + WEEK_MS) {
      throw new HttpError(422, "E.PLAN.INVALID_TEMPLATE",
        "Template date must be within the first week of the plan");
    }
    seen.add(at.getTime());
    for (let week = 1; week < durationWeeks; week += 1) {
      const local = localEpoch(wall, at.getUTCMilliseconds()) + week * WEEK_MS;
      occurrences.push({ sourceId: template.id, plannedAt: localToUtc(local, timeZone) });
    }
  }
  return occurrences;
}
