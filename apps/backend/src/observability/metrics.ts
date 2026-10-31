import type { NextFunction, Request, Response } from "express";
import client from "prom-client";

const register = new client.Registry();

// Store the default metrics collector so we can stop it during tests
// collectDefaultMetrics may return a stop function or void depending on version/options
let defaultMetricsCollector: (() => void) | null = null;

// Only collect default metrics if NOT in test environment
// This prevents timers from being created in the first place
// Check NODE_ENV at module load time - jest.setup.ts sets this before any imports
if (process.env.NODE_ENV !== "test") {
  const result = client.collectDefaultMetrics({ register });
  // Only store if it returns a function (some versions return void)
  if (typeof result === "function") {
    defaultMetricsCollector = result;
  }
}

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const refreshReuseCounter = new client.Counter({
  name: "jwt_refresh_reuse_total",
  help: "Number of refresh token reuse incidents that triggered session family revocation",
});

// Security counters intentionally contain NO user ID, email, token, IP or session labels.
// Fixed enumerations bound cardinality and avoid exporting sensitive identifiers.
const failedLoginCounter = new client.Counter({
  name: "auth_failed_login_total",
  help: "Failed credential verification attempts, including unknown identifiers",
});

const blockedLoginCounter = new client.Counter({
  name: "auth_login_blocked_total",
  help: "Authentication attempts blocked by an existing account or IP lockout",
  labelNames: ["scope"],
});

const successfulLoginCounter = new client.Counter({
  name: "auth_login_success_total",
  help: "Completed login sessions by authentication method",
  labelNames: ["factor"],
});

const passwordResetCounter = new client.Counter({
  name: "auth_password_reset_total",
  help: "Password reset requests and completion outcomes",
  labelNames: ["outcome"],
});

const mfaEventCounter = new client.Counter({
  name: "auth_mfa_events_total",
  help: "MFA enrollment, disablement and login outcomes",
  labelNames: ["event"],
});

const pointsAwardedCounter = new client.Counter({
  name: "points_awarded_total",
  help: "Total points awarded grouped by rule",
  labelNames: ["rule"],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(refreshReuseCounter);
register.registerMetric(failedLoginCounter);
register.registerMetric(blockedLoginCounter);
register.registerMetric(successfulLoginCounter);
register.registerMetric(passwordResetCounter);
register.registerMetric(mfaEventCounter);
register.registerMetric(pointsAwardedCounter);

function resolveRouteLabel(req: Request): string {
  const maybeRoute: unknown = req.route;
  if (maybeRoute && typeof maybeRoute === "object" && "path" in maybeRoute) {
    const routePath = (maybeRoute as { path?: unknown }).path;
    if (typeof routePath === "string" && routePath.length > 0) {
      return req.baseUrl ? `${req.baseUrl}${routePath}` : routePath;
    }
  }
  if (req.baseUrl) {
    return req.baseUrl;
  }
  return req.originalUrl.split("?")[0];
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const endTimer = httpRequestDuration.startTimer({
    method: req.method,
    route: resolveRouteLabel(req),
  });

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: resolveRouteLabel(req),
      status_code: String(res.statusCode),
    };
    endTimer(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
}

export async function metricsRoute(_req: Request, res: Response) {
  res.set("Content-Type", register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
}

export function incrementRefreshReuse() {
  refreshReuseCounter.inc();
}

export function incrementAuthFailedLogin(): void {
  failedLoginCounter.inc();
}

export function incrementAuthBlockedLogin(scope: "account" | "ip"): void {
  blockedLoginCounter.inc({ scope });
}

export function incrementAuthLoginSuccess(factor: "password" | "mfa"): void {
  successfulLoginCounter.inc({ factor });
}

export function incrementAuthPasswordReset(outcome: "requested" | "completed" | "invalid_token" | "failed"): void {
  passwordResetCounter.inc({ outcome });
}

export function incrementAuthMfaEvent(event: "enrolled" | "disabled" | "login_failed" | "login_success" | "blocked"): void {
  mfaEventCounter.inc({ event });
}

export function incrementPointsAwarded(rule: string, amount: number) {
  pointsAwardedCounter.inc({ rule }, amount);
}

/**
 * Stop default metrics collection
 * This should be called during test teardown to prevent open handles
 * Note: In test environment, default metrics are not collected, so this is a no-op
 */
export function stopMetricsCollection(): void {
  if (defaultMetricsCollector) {
    defaultMetricsCollector();
    defaultMetricsCollector = null;
  }
  // Note: We don't clear the register as tests may need to access metrics
}
