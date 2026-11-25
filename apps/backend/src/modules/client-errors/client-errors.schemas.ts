import { z } from "zod";

/**
 * Browser error report (ADR-040).
 *
 * Deliberately small and identity-free: no user id, email, query strings or
 * free-form context objects. Limits bound log volume per report.
 */
export const CLIENT_ERROR_KINDS = ["error", "unhandledrejection", "logger"] as const;

export const CLIENT_ERROR_LIMITS = {
  message: 1000,
  stack: 4000,
  source: 500,
  route: 200,
} as const;

export const ClientErrorReportSchema = z
  .object({
    kind: z.enum(CLIENT_ERROR_KINDS),
    message: z.string().min(1).max(CLIENT_ERROR_LIMITS.message),
    stack: z.string().max(CLIENT_ERROR_LIMITS.stack).optional(),
    source: z.string().max(CLIENT_ERROR_LIMITS.source).optional(),
    route: z.string().regex(/^\//, "route must be a path").max(CLIENT_ERROR_LIMITS.route),
  })
  .strict();

export type ClientErrorReport = z.infer<typeof ClientErrorReportSchema>;
