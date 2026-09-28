import express, { Router } from "express";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { rateLimitFromPolicy } from "./middlewares/rate-limit.js";
import { getRuntimeAppSetting } from "./modules/system/app-settings.runtime.js";
import { csrfProtection, csrfTokenRoute, validateOrigin } from "./middlewares/csrf.js";
import { httpLogger } from "./middlewares/request-logger.js";
import { errorHandler } from "./middlewares/error.handler.js";
import { readOnlyGuard } from "./middlewares/read-only.guard.js";
import { detectSuspiciousPatterns } from "./middlewares/enhanced-security.js";
import { metricsMiddleware, metricsRoute } from "./observability/metrics.js";
import { asyncHandler } from "./utils/async-handler.js";

import { authRouter } from "./api/auth.routes.js";
import { usersRouter } from "./api/users.routes.js";
import { exerciseTypesRouter } from "./api/exerciseTypes.routes.js";
import { exercisesRouter } from "./api/exercises.routes.js";
import { sessionsRouter } from "./api/sessions.routes.js";
import { plansRouter } from "./api/plans.routes.js";
import { progressRouter } from "./api/progress.routes.js";
import { pointsRouter } from "./api/points.routes.js";
import { feedRouter } from "./api/feed.routes.js";
import { adminRouter } from "./api/admin.routes.js";
import { contactRouter } from "./api/contact.routes.js";
import { translationsRouter } from "./api/translations.routes.js";
import { measurementsRouter } from "./api/measurements.routes.js";
import { legalRouter } from "./api/legal.routes.js";
import { vibeformsRouter } from "./api/vibeforms.routes.js";
import healthRouter from "./modules/health/health.router.js";
import systemRouter from "./modules/system/system.routes.js";
import { appSettingsRouter } from "./modules/system/app-settings.routes.js";
import { consentRouter } from "./modules/consent/consent.routes.js";
import { logsRouter } from "./modules/logs/logs.routes.js";
import { jwksHandler } from "./modules/auth/auth.controller.js";

const app = express();

if (!env.csrf.enabled) {
  const warning =
    "[security] CSRF protection is disabled. Only disable this for automated testing or local workflows.";
  if (env.isProduction) {
    throw new Error(`${warning} Refusing to start in production without CSRF.`);
  }
  logger.warn(warning);
}

if (env.isProduction && !env.clamav.enabled) {
  throw new Error(
    "[security] ClamAV scanning is disabled. Refusing to start production with uploads unscanned.",
  );
}

app.set("trust proxy", env.trustProxy);
app.get("/.well-known/jwks.json", jwksHandler);

app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.use(httpLogger);

if (env.metricsEnabled) {
  app.use(metricsMiddleware);
  app.get("/metrics", asyncHandler(metricsRoute));
}

const corsOrigins = env.allowedOrigins;
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    const error: Error & { status?: number; code?: string } = new Error(
      "Origin not allowed by CORS",
    );
    error.status = 403;
    error.code = "FORBIDDEN";
    return callback(error);
  },
  credentials: true,
};

// Helmet security middleware with explicit CSP/HSTS hardening
app.use(
  helmet({
    // Strict Transport Security (HSTS) - enforce HTTPS for 180 days (6 months)
    hsts: {
      maxAge: 15552000, // 180 days in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Content Security Policy - prevent XSS and injection attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Strict referrer policy - no referrer information
    referrerPolicy: {
      policy: "no-referrer",
    },
    // X-Frame-Options - prevent clickjacking (allow same-origin iframes)
    frameguard: {
      action: "sameorigin",
    },
    // X-Content-Type-Options - prevent MIME type sniffing
    noSniff: true,
    // X-XSS-Protection - enable browser XSS filter
    xssFilter: true,
  }),
);

// Permissions-Policy - restrict access to browser features
app.use((_, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );
  next();
});

app.use(cors(corsOptions));
// Handle OPTIONS requests for all routes (CORS preflight)
// CORS middleware handles OPTIONS automatically, but we add explicit handler for compatibility
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return cors(corsOptions)(req, res, next);
  }
  next();
});
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
// Global rate limiting is governed and resolved lazily from the loaded settings revision.
// lgtm[js/missing-rate-limiting] - Rate limiting IS applied globally here
app.use(
  rateLimitFromPolicy("global", () => ({
    points: getRuntimeAppSetting<number>("security.global_rate_limit_points"),
    duration: getRuntimeAppSetting<number>("security.global_rate_limit_duration_seconds"),
  })),
);

// CSRF protection enabled for all state-changing requests (POST/PUT/PATCH/DELETE)
// Requires valid CSRF token in header or body. Safe methods (GET/HEAD/OPTIONS) bypass.
// SECURITY: CSRF middleware is applied here to protect all state-changing requests
// codeql[js/missing-csrf-middleware] - CSRF middleware IS applied at line 146, after body parsing (required order)
// lgtm[js/missing-csrf-middleware] - CSRF middleware IS applied here (line 145-146)
if (env.csrf.enabled) {
  const origins = env.csrf.allowedOrigins.length ? env.csrf.allowedOrigins : corsOrigins;
  if (origins.length) {
    app.use(validateOrigin(origins));
  }
  app.use(csrfProtection); // CSRF protection applied globally
}

// Detect suspicious patterns in body/query (SQL injection, XSS) - reject before reaching handlers
app.use(detectSuspiciousPatterns);

// Apply read-only mode guard to protect against mutations during maintenance
app.use(readOnlyGuard);

const apiRouter = Router();

if (env.csrf.enabled) {
  apiRouter.get("/csrf-token", csrfTokenRoute);
}

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/exercise-types", exerciseTypesRouter);
apiRouter.use("/exercises", exercisesRouter);
apiRouter.use("/sessions", sessionsRouter);
apiRouter.use("/plans", plansRouter);
apiRouter.use("/progress", progressRouter);
apiRouter.use("/points", pointsRouter);
apiRouter.use("/feed", feedRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/contact", contactRouter);
apiRouter.use("/logs", logsRouter);

apiRouter.use("/system", systemRouter);
apiRouter.use("/system/settings", appSettingsRouter);
apiRouter.use("/consent", consentRouter);
apiRouter.use("/translations", translationsRouter);
apiRouter.use("/legal", legalRouter);
apiRouter.use("/measurements", measurementsRouter);
apiRouter.use("/vibeforms", vibeformsRouter);

app.use("/api/v1", apiRouter);
app.use("/health", healthRouter);

app.use((_req, res, _next) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      requestId: res.locals.requestId,
    },
  });
});

app.use(errorHandler);

export const appInstance = app;

export default app;
