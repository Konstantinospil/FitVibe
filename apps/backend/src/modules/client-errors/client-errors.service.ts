import { logger } from "../../config/logger.js";
import { incrementClientErrorReport } from "../../observability/metrics.js";
import type { ClientErrorReport } from "./client-errors.schemas.js";

const EMAIL_PATTERN = /[^\s@/'"<>()]+@[^\s@/'"<>()]+\.[a-z]{2,}/gi;
// Query strings and fragments can carry one-time tokens (registration,
// password reset, verification links). Drop everything after ? or # up to the
// next whitespace or quote.
const URL_QUERY_OR_FRAGMENT = /[?#][^\s'"<>()]*/g;
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Remove values that could identify a person or grant access before the
 * report is written to logs. The client sanitizes too; the server does not
 * trust it to.
 */
export function sanitizeClientErrorText(value: string): string {
  return value
    .replace(CONTROL_CHARACTERS, "")
    .replace(URL_QUERY_OR_FRAGMENT, "")
    .replace(EMAIL_PATTERN, "[email]");
}

export function sanitizeClientErrorReport(report: ClientErrorReport): ClientErrorReport {
  return {
    kind: report.kind,
    message: sanitizeClientErrorText(report.message),
    ...(report.stack ? { stack: sanitizeClientErrorText(report.stack) } : {}),
    ...(report.source ? { source: sanitizeClientErrorText(report.source) } : {}),
    route: sanitizeClientErrorText(report.route),
  };
}

export function recordClientError(report: ClientErrorReport, requestId?: string): void {
  const clientError = sanitizeClientErrorReport(report);
  incrementClientErrorReport(clientError.kind);
  logger.warn({ clientError, requestId }, "[client-error] Browser reported an error");
}
