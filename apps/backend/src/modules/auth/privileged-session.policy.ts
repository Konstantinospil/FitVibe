/**
 * #557 — Privileged sessions have an absolute server-side lifetime and
 * inactivity cutoff, independent of the expiry in previously issued JWTs.
 * Values are deliberately constants until an audited configuration contract
 * with range validation is introduced.
 */
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_IDLE_MS = 15 * 60 * 1000;
export const ADMIN_ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;

export function isPrivilegedRole(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

export interface PrivilegedSessionDates {
  created_at: string;
  last_active_at?: string | null;
}

export function privilegedSessionDeadline(session: PrivilegedSessionDates): number {
  const created = Date.parse(session.created_at);
  const activity = Date.parse(session.last_active_at ?? session.created_at);
  if (!Number.isFinite(created) || !Number.isFinite(activity)) {
    return Number.NEGATIVE_INFINITY;
  }
  return Math.min(created + ADMIN_SESSION_MAX_AGE_MS, activity + ADMIN_SESSION_IDLE_MS);
}

export function isPrivilegedSessionActive(
  session: PrivilegedSessionDates,
  now = Date.now(),
): boolean {
  return now < privilegedSessionDeadline(session);
}

export function privilegedAbsoluteExpiry(
  session: Pick<PrivilegedSessionDates, "created_at">,
): number {
  const created = Date.parse(session.created_at);
  return Number.isFinite(created) ? created + ADMIN_SESSION_MAX_AGE_MS : Number.NEGATIVE_INFINITY;
}
