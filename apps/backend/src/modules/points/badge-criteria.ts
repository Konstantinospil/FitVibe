export const VIBE_TYPE_CODES = [
  "strength",
  "agility",
  "endurance",
  "explosivity",
  "intelligence",
  "regeneration",
] as const;

export type VibeTypeCode = (typeof VIBE_TYPE_CODES)[number];

export interface BadgeCriteriaContext {
  userId: string;
  completedSessions: number;
  typeCodeSessionCounts: Map<string, number>;
  distinctTypeCodesByWindow: Map<number, Set<string>>;
  completedDates: Set<string>;
  completedAt: Date;
  runDistanceMeters: number;
  rideDistanceMeters: number;
  rowDistanceMeters: number;
  sessionsInCalendarDay: number;
  startHourUtc: number | null;
  visibility: string;
  personalRecordCount: number;
  followerCount: number;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function truncateIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function streakMet(requiredDays: number, completedAt: Date, dates: Set<string>): boolean {
  const cursor = new Date(completedAt);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < requiredDays; i += 1) {
    if (!dates.has(truncateIsoDate(cursor))) {
      return false;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return true;
}

function distinctForWindow(ctx: BadgeCriteriaContext, windowDays: number): Set<string> {
  const existing = ctx.distinctTypeCodesByWindow.get(windowDays);
  if (existing) {
    return existing;
  }
  return new Set();
}

/**
 * Returns true when every declared criterion is satisfied.
 * Unknown keys are ignored. `requires` always fails (catalog-only until that feature exists).
 */
export function criteriaMet(criteria: Record<string, unknown>, ctx: BadgeCriteriaContext): boolean {
  if (Object.keys(criteria).length === 0) {
    return false;
  }
  if (asString(criteria.requires)) {
    return false;
  }

  const typeCode = asString(criteria.type_code);
  const completedNeed = asNumber(criteria.completed_sessions);
  if (completedNeed !== null) {
    const count = typeCode ? (ctx.typeCodeSessionCounts.get(typeCode) ?? 0) : ctx.completedSessions;
    if (count < completedNeed) {
      return false;
    }
  } else if (typeCode && (ctx.typeCodeSessionCounts.get(typeCode) ?? 0) < 1) {
    return false;
  }

  const consecutive = asNumber(criteria.consecutive_days);
  if (consecutive !== null && !streakMet(consecutive, ctx.completedAt, ctx.completedDates)) {
    return false;
  }

  const windowDays = asNumber(criteria.window_days);
  const distinctNeed = asNumber(criteria.distinct_type_codes);
  if ((distinctNeed !== null || criteria.all_type_codes === true) && windowDays === null) {
    return false;
  }
  if (distinctNeed !== null) {
    const distinct = distinctForWindow(ctx, windowDays as number);
    const vibeDistinct = [...distinct].filter((code) =>
      (VIBE_TYPE_CODES as readonly string[]).includes(code),
    );
    if (vibeDistinct.length < distinctNeed) {
      return false;
    }
  }

  if (criteria.all_type_codes === true) {
    const distinct = distinctForWindow(ctx, windowDays as number);
    const hasAll = VIBE_TYPE_CODES.every((code) => distinct.has(code));
    if (!hasAll) {
      return false;
    }
  }

  const runNeed = asNumber(criteria.run_distance_m);
  if (runNeed !== null && ctx.runDistanceMeters < runNeed) {
    return false;
  }
  const rideNeed = asNumber(criteria.ride_distance_m);
  if (rideNeed !== null && ctx.rideDistanceMeters < rideNeed) {
    return false;
  }
  const rowNeed = asNumber(criteria.row_distance_m);
  if (rowNeed !== null && ctx.rowDistanceMeters < rowNeed) {
    return false;
  }

  const sessionsDay = asNumber(criteria.sessions_in_calendar_day);
  if (sessionsDay !== null && ctx.sessionsInCalendarDay < sessionsDay) {
    return false;
  }

  const hourLte = asNumber(criteria.start_hour_lte);
  if (hourLte !== null) {
    if (ctx.startHourUtc === null || ctx.startHourUtc > hourLte) {
      return false;
    }
  }
  const hourGte = asNumber(criteria.start_hour_gte);
  if (hourGte !== null) {
    if (ctx.startHourUtc === null || ctx.startHourUtc < hourGte) {
      return false;
    }
  }

  if (criteria.visibility !== undefined) {
    const allowed = Array.isArray(criteria.visibility)
      ? criteria.visibility.filter((item): item is string => typeof item === "string")
      : asString(criteria.visibility)
        ? [asString(criteria.visibility) as string]
        : [];
    if (allowed.length > 0 && !allowed.includes(ctx.visibility)) {
      return false;
    }
  }

  const prNeed = asNumber(criteria.personal_records);
  if (prNeed !== null && ctx.personalRecordCount < prNeed) {
    return false;
  }

  const followNeed = asNumber(criteria.follower_count);
  if (followNeed !== null && ctx.followerCount < followNeed) {
    return false;
  }

  return true;
}
