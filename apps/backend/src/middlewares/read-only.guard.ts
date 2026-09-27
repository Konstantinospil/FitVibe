// src/middlewares/read-only.guard.ts
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { getRuntimeGovernanceState, isEffectiveReadOnly } from "../modules/system/app-settings.runtime.js";
import { logger } from "../config/logger.js";

/** Methods that can mutate state */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Allow-list with or without API version prefix */
const ALLOWLIST_REGEX: RegExp[] = [
  /^\/health(?:\/.*)?$/i,
  /^\/metrics(?:\/.*)?$/i,
  /^\/\.well-known\/jwks\.json$/i,
  /^\/(?:api\/v\d+\/)?system\/read-only\/status$/i,
  /^\/(?:api\/v\d+\/)?system\/read-only\/enable$/i,
  /^\/(?:api\/v\d+\/)?system\/read-only\/disable$/i,
  /^\/(?:api\/v\d+\/)?system\/settings(?:\/.*)?$/i,
  /^\/(?:api\/v\d+\/)?auth\/refresh$/i,
];

function isAllowlisted(urlPath: string): boolean {
  return ALLOWLIST_REGEX.some((re) => re.test(urlPath));
}

// Safe extractor to avoid "no-unsafe-member-access"
type MaybeUser = { sub?: string } | undefined;
function getUserId(req: Request): string | undefined {
  const u = (req as Request & { user?: MaybeUser }).user;
  return typeof u?.sub === "string" ? u.sub : undefined;
}

export function readOnlyGuard(req: Request, res: Response, next: NextFunction): void {
  // In test environment, only bypass when read-only is not explicitly enabled
  // (so tests can still assert 503 by setting env.readOnlyMode = true)
  if (env.NODE_ENV === "test" && !env.readOnlyMode) {
    next();
    return;
  }
  // Fast path: nothing to enforce.
  if (!isEffectiveReadOnly()) {
    next();
    return;
  }

  // Allow safe HTTP methods
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  // Use originalUrl to include mount prefixes
  const urlPath = req.originalUrl || req.path;

  // Allow critical/system endpoints
  if (isAllowlisted(urlPath)) {
    next();
    return;
  }

  // Block mutation (return void, not Response)
  logger.warn(
    {
      method: req.method,
      path: urlPath,
      ip: req.ip,
      userId: getUserId(req),
      requestId: res.locals.requestId,
    },
    "[read-only] Mutation request blocked",
  );

  res.status(503).json({
    error: {
      code: "E.SYSTEM.READ_ONLY",
      message:
        (getRuntimeGovernanceState().settings["system.maintenance_message"] as string | undefined) ??
        env.maintenanceMessage ??
        "System is in read-only mode",
      details: {
        readOnlyMode: true,
        method: req.method,
        path: urlPath,
        activeRevision: getRuntimeGovernanceState().activeRevision,
        loadedRevision: getRuntimeGovernanceState().loadedRevision,
        emergencyReadOnly: getRuntimeGovernanceState().emergencyReadOnly,
      },
      requestId: res.locals.requestId,
    },
  });
  return;
}
