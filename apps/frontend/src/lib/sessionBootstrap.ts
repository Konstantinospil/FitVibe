/**
 * Early start of the authenticated bootstrap requests (issue 634).
 *
 * Without this, an authenticated reload waits for the main bundle to mount,
 * then for ProtectedRoutes to request preferences, then for ProtectedRoute to
 * request legal and admin-password status: two API round trips in series after
 * the app has already rendered. Those requests do not depend on each other or
 * on rendering, so `main.tsx` starts them as soon as it runs and the consumers
 * pick up the in-flight promises.
 *
 * Security properties (the guard's decisions are unchanged):
 * - Requests are only started for a browser that already has a session flag;
 *   they are ordinary GETs authorised by the HttpOnly session cookie.
 * - Guard results are bound to the identity key computed when they were
 *   requested. ProtectedRoute only adopts them for an identical key, otherwise
 *   it fetches fresh results exactly as before.
 * - Every result can be taken once, and only within MAX_AGE_MS of being
 *   requested. Any later check fetches fresh data.
 * - Any sign-in or sign-out discards whatever has not been taken yet.
 */
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  getUserPreferences,
  type LegalDocumentsStatus,
  type UserPreferences,
} from "../services/api";

export const SESSION_BOOTSTRAP_MAX_AGE_MS = 10_000;

type IdentityUser = { id: string; role?: string } | null | undefined;

export type AdministratorPasswordPolicyStatus = Awaited<
  ReturnType<typeof getAdministratorPasswordPolicyStatus>
>;

/**
 * The identity a guard result belongs to: session state, user id and role class.
 * A missing user (a reload before the profile is known) is its own class and
 * still requires the administrator check.
 */
export function computeGuardKey(isAuthenticated: boolean, user: IdentityUser): string {
  if (!isAuthenticated) {
    return "signed-out";
  }
  const roleClass = !user
    ? "role-missing"
    : user.role === "admin" || user.role === "superadmin"
      ? "admin"
      : "member";
  return `${user?.id ?? "unknown-user"}|${roleClass}`;
}

/** Whether the guard must ask the server for the administrator password policy. */
export function needsAdministratorCheck(user: IdentityUser): boolean {
  return !user || user.role === "admin" || user.role === "superadmin";
}

type Pending<T> = { promise: Promise<T>; startedAt: number };

type GuardChecks = {
  key: string;
  legal?: Pending<LegalDocumentsStatus>;
  adminPolicy?: Pending<AdministratorPasswordPolicyStatus>;
};

let preferences: Pending<UserPreferences> | undefined;
let guardChecks: GuardChecks | undefined;

const now = (): number => Date.now();

function track<T>(load: () => Promise<T>): Pending<T> {
  const promise = load();
  // The consumer handles failures. Until it takes the promise, keep a rejected
  // request from surfacing as an unhandled rejection.
  promise.catch(() => undefined);
  return { promise, startedAt: now() };
}

function fresh<T>(pending: Pending<T> | undefined): Promise<T> | undefined {
  if (!pending || now() - pending.startedAt > SESSION_BOOTSTRAP_MAX_AGE_MS) {
    return undefined;
  }
  return pending.promise;
}

/**
 * Starts preferences, legal status and (when the guard will need it)
 * administrator password status. Does nothing without a session or if a
 * bootstrap for the same identity is already waiting to be taken.
 */
export function startSessionBootstrap(isAuthenticated: boolean, user: IdentityUser): void {
  if (!isAuthenticated) {
    return;
  }
  const key = computeGuardKey(isAuthenticated, user);
  if (guardChecks?.key === key) {
    return;
  }
  preferences = track(getUserPreferences);
  guardChecks = {
    key,
    legal: track(getLegalDocumentsStatus),
    adminPolicy: needsAdministratorCheck(user)
      ? track(getAdministratorPasswordPolicyStatus)
      : undefined,
  };
}

/** Takes the early preferences request, if one is still fresh. Single use. */
export function takeBootstrapPreferences(): Promise<UserPreferences> | undefined {
  const taken = fresh(preferences);
  preferences = undefined;
  return taken;
}

/**
 * Takes the early legal-status request for exactly this identity, if fresh.
 * Single use; a different key never receives another identity's result.
 */
export function takeBootstrapLegalStatus(key: string): Promise<LegalDocumentsStatus> | undefined {
  if (!guardChecks || guardChecks.key !== key) {
    return undefined;
  }
  const taken = fresh(guardChecks.legal);
  guardChecks.legal = undefined;
  return taken;
}

/** Same contract as takeBootstrapLegalStatus, for the administrator check. */
export function takeBootstrapAdministratorPolicy(
  key: string,
): Promise<AdministratorPasswordPolicyStatus> | undefined {
  if (!guardChecks || guardChecks.key !== key) {
    return undefined;
  }
  const taken = fresh(guardChecks.adminPolicy);
  guardChecks.adminPolicy = undefined;
  return taken;
}

/** Drops anything not yet taken. Called on every sign-in and sign-out. */
export function discardSessionBootstrap(): void {
  preferences = undefined;
  guardChecks = undefined;
}
