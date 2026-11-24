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
 *
 * The module is also a build entry of its own, loaded from <head> by the SSR
 * renderer, and starts itself when the tab has a stored session. It must stay
 * free of imports: anything it imports would have to download first.
 */

/** Same key and value as the auth store's session flag (store/auth.store.ts). */
const SESSION_FLAG_KEY = "fitvibe:auth";

export function hasStoredSession(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export type PrefetchKey = "preferences" | "legalDocumentsStatus" | "adminPasswordStatus";

const ENDPOINTS: Record<PrefetchKey, string> = {
  preferences: "/api/v1/users/me/preferences",
  legalDocumentsStatus: "/api/v1/auth/legal-documents/status",
  adminPasswordStatus: "/api/v1/auth/admin-password/status",
};

type LegalDocumentType = "terms" | "privacy" | "cookie";

const LEGAL_DOCUMENT_PATHS: Record<string, LegalDocumentType> = {
  "/terms": "terms",
  "/privacy": "privacy",
  "/cookie": "cookie",
};

type EarlyLegalDocument = { type: LegalDocumentType; language: string; value: unknown } | null;

let pending: Partial<Record<PrefetchKey, Promise<unknown>>> | null = null;
let pendingLegalDocument: Promise<EarlyLegalDocument> | null = null;

function baseLanguage(language: unknown): string | null {
  return typeof language === "string" && language ? language.split("-")[0] : null;
}

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

  // Legal pages render the published document, which is their LCP. It is
  // requested in the account language, so read it once the preferences arrive.
  const documentType = LEGAL_DOCUMENT_PATHS[window.location.pathname];
  const preferences = pending.preferences;
  if (documentType && preferences) {
    pendingLegalDocument = preferences.then(async (value) => {
      const language = baseLanguage((value as { language?: unknown } | null)?.language);
      if (!language) {
        return null;
      }
      const url = `${base}/api/v1/legal/documents/${documentType}?language=${encodeURIComponent(language)}`;
      const document = await readJson(url);
      return document === null ? null : { type: documentType, language, value: document };
    });
  }
}

/** Discard every unused early result. */
export function clearAuthenticatedPrefetch(): void {
  pending = null;
  pendingLegalDocument = null;
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

/**
 * The early published legal document if it was read for exactly this type and
 * language, otherwise the normal request. Consumes the early result.
 */
export async function takePrefetchedLegalDocument<T>(
  type: LegalDocumentType,
  language: string,
  load: () => Promise<T>,
): Promise<T> {
  const early = pendingLegalDocument;
  pendingLegalDocument = null;
  if (!early) {
    return load();
  }
  const result = await early;
  return result && result.type === type && result.language === baseLanguage(language)
    ? (result.value as T)
    : load();
}

if (hasStoredSession()) {
  startAuthenticatedPrefetch();
}
