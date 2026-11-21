"use strict";

// Allow a bounded rerun only for a technical measurement invalidated by the
// real consent-status rate limiter. Slow but valid Lighthouse scores are never retried.
function shouldRetryConsentRateLimit(report, diagnostic, attempt, maxRetries = 1) {
  if (attempt > maxRetries || !diagnostic?.includes("Backend HTTP 429")) {
    return false;
  }
  return (report?.audits?.["network-requests"]?.details?.items ?? []).some((item) => {
    if (item.statusCode !== 429) return false;
    try {
      return new URL(item.url).pathname === "/api/v1/consent/cookie-status";
    } catch {
      return false;
    }
  });
}

module.exports = { shouldRetryConsentRateLimit };
