/**
 * Early reads for a page load that starts with a stored session.
 *
 * Every authenticated route waits for the account preferences and for two
 * guard checks (legal documents, administrator password policy) before it
 * renders. Requested through the API service, they only start once the
 * protected-route chunk and its i18n dependencies have downloaded, which made
 * them a separate round trip on the LCP critical path. This module has no
 * dependencies, so the entry can start the reads while those chunks are still
 * downloading.
 *
 * Rules that keep this equivalent to the normal requests:
 * - Only plain GETs that need no CSRF token, sent with the same credentials as
 *   the API client.
 * - Each early result is used at most once, by the first consumer.
 * - Anything but a successful JSON response yields to the normal request, so
 *   token refresh and error handling stay in the API client.
 * - A sign-in, sign-out or account change discards unused results, so a guard
 *   never sees a response fetched for another session.
 */

export type PrefetchKey = "preferences" | "legalDocumentsStatus" | "adminPasswordStatus";

const ENDPOINTS: Record<PrefetchKey, string> = {
  preferences: "/api/v1/users/me/preferences",
  legalDocumentsStatus: "/api/v1/auth/legal-documents/status",
  adminPasswordStatus: "/api/v1/auth/admin-password/status",
};

let pending: Partial<Record<PrefetchKey, Promise<unknown>>> | null = null;

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? "";
}

async function readJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok ? ((await response.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/** Start the reads. Call only when the page load begins with a stored session. */
export function startAuthenticatedPrefetch(): void {
  if (pending || typeof window === "undefined" || typeof fetch !== "function") {
    return;
  }
  const base = apiBaseUrl();
  pending = {};
  for (const key of Object.keys(ENDPOINTS) as PrefetchKey[]) {
    pending[key] = readJson(base + ENDPOINTS[key]);
  }
}

/** Discard every unused early result. */
export function clearAuthenticatedPrefetch(): void {
  pending = null;
}

/**
 * The early result for `key` if one is usable, otherwise the normal request.
 * Consumes the early result, so later calls always use `load`.
 */
export async function takePrefetched<T>(key: PrefetchKey, load: () => Promise<T>): Promise<T> {
  const early = pending?.[key];
  if (pending) {
    delete pending[key];
  }
  if (!early) {
    return load();
  }
  const value = await early;
  return value === null || value === undefined ? load() : (value as T);
}
