import { HttpError } from "../../utils/http.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** A plan's existing sessions represent its first week. Recur each one weekly in UTC. */
export function buildWeeklyOccurrences(
  startDate: string,
  durationWeeks: number,
  targetFrequency: number,
  templates: Array<{ id: string; planned_at: string }>,
): Array<{ sourceId: string; plannedAt: string }> {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !Number.isFinite(start) ||
    new Date(start).toISOString().slice(0, 10) !== startDate ||
    !Number.isInteger(durationWeeks) ||
    durationWeeks < 1 || durationWeeks > 52 ||
    !Number.isInteger(targetFrequency) ||
    targetFrequency < 1 || targetFrequency > 7
  ) {
    throw new HttpError(422, "E.PLAN.INVALID_SCHEDULE", "Invalid plan start date, duration or frequency");
  }
  if (templates.length !== targetFrequency) {
    throw new HttpError(422, "E.PLAN.TEMPLATE_MISMATCH", "First-week sessions must match target_frequency");
  }
  const seen = new Set<number>();
  const occurrences: Array<{ sourceId: string; plannedAt: string }> = [];
  for (const template of templates) {
    const at = Date.parse(template.planned_at);
    if (!Number.isFinite(at) || at < start || at >= start + WEEK_MS || seen.has(at)) {
      throw new HttpError(422, "E.PLAN.INVALID_TEMPLATE", "Each template must have a unique time within the first plan week");
    }
    seen.add(at);
    for (let week = 1; week < durationWeeks; week += 1) {
      occurrences.push({ sourceId: template.id, plannedAt: new Date(at + week * WEEK_MS).toISOString() });
    }
  }
  return occurrences;
}

export function planEndDate(startDate: string, durationWeeks: number): string {
  return new Date(Date.parse(`${startDate}T00:00:00.000Z`) + durationWeeks * WEEK_MS - DAY_MS)
    .toISOString().slice(0, 10);
}
