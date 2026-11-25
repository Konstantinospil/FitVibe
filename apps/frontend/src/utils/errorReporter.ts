/**
 * First-party browser error reporting (ADR-040).
 *
 * Sends uncaught errors, unhandled promise rejections and logger.error calls to
 * FitVibe's own backend. No third-party SDK, no identity, no cookies beyond the
 * existing CSRF pair. The HTTP client is loaded only when the first report is
 * sent, so pages without errors pay nothing.
 *
 * This module must stay import-free: logger.ts imports it, and it is installed
 * from main.tsx before the app renders.
 */

export type ClientErrorKind = "error" | "unhandledrejection" | "logger";

const ENDPOINT = "/api/v1/client-errors";
// Matches the server schema (apps/backend/src/modules/client-errors).
const LIMITS = { message: 1000, stack: 4000, source: 500, route: 200 } as const;
// One broken page must not flood the log or the rate limit.
const MAX_REPORTS_PER_PAGE = 10;

const EMAIL_PATTERN = /[^\s@/'"<>()]+@[^\s@/'"<>()]+\.[a-z]{2,}/gi;
// Query strings and fragments can carry one-time tokens (registration,
// password reset, verification links).
const URL_QUERY_OR_FRAGMENT = /[?#][^\s'"<>()]*/g;

let installed = false;
let reportsSent = 0;
const reported = new Set<string>();

function sanitize(value: string, limit: number): string {
  return value.replace(URL_QUERY_OR_FRAGMENT, "").replace(EMAIL_PATTERN, "[email]").slice(0, limit);
}

function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: reason.message || reason.name, stack: reason.stack };
  }
  if (typeof reason === "string") {
    return { message: reason };
  }
  return { message: "Non-error value thrown" };
}

async function send(payload: Record<string, string>): Promise<void> {
  try {
    const { rawHttpClient } = await import("../services/httpApi");
    await rawHttpClient.post(ENDPOINT, payload);
  } catch {
    // Never report or log a failed report: that would loop.
  }
}

/**
 * Report one browser error. A no-op until installErrorReporting() has run, so
 * SSR, unit tests and development builds send nothing unless they opt in.
 */
export function reportClientError(
  kind: ClientErrorKind,
  rawMessage: string,
  rawStack?: string,
  rawSource?: string,
): void {
  if (!installed || reportsSent >= MAX_REPORTS_PER_PAGE) {
    return;
  }
  const message = sanitize(rawMessage.trim(), LIMITS.message);
  // "Script error." is all a browser exposes for cross-origin scripts.
  if (!message || message === "Script error.") {
    return;
  }
  const key = `${kind}|${message}`;
  if (reported.has(key)) {
    return;
  }
  reported.add(key);
  reportsSent += 1;

  const payload: Record<string, string> = {
    kind,
    message,
    route: sanitize(window.location.pathname || "/", LIMITS.route),
  };
  if (rawStack) {
    payload.stack = sanitize(rawStack, LIMITS.stack);
  }
  if (rawSource) {
    payload.source = sanitize(rawSource, LIMITS.source);
  }
  void send(payload);
}

/** Report an error passed to logger.error (message plus the Error, never context). */
export function reportLoggedError(message: string, error?: unknown): void {
  const detail = error === undefined ? undefined : describe(error);
  reportClientError("logger", detail ? `${message}: ${detail.message}` : message, detail?.stack);
}

function onError(event: Event): void {
  // Failed <img>/<script> loads dispatch a plain Event, not an ErrorEvent.
  if (!(event instanceof ErrorEvent)) {
    return;
  }
  const detail = describe(event.error ?? event.message);
  reportClientError("error", event.message || detail.message, detail.stack, event.filename);
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const detail = describe(event.reason);
  reportClientError("unhandledrejection", detail.message, detail.stack);
}

export function installErrorReporting(): void {
  if (installed || typeof window === "undefined") {
    return;
  }
  installed = true;
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
}

/** Test-only: return the module to its initial state. */
export function resetErrorReportingForTests(): void {
  if (typeof window !== "undefined") {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }
  installed = false;
  reportsSent = 0;
  reported.clear();
}
