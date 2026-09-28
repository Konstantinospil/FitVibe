import { RateLimiterMemory } from "rate-limiter-flexible";
import type { NextFunction, Request, Response } from "express";
import { extractClientIpForRateLimit } from "../utils/ip-extractor.js";

const limiters = new Map<string, RateLimiterMemory>();

function getLimiter(key: string, points = 60, duration = 60) {
  if (!limiters.has(key)) {
    limiters.set(key, new RateLimiterMemory({ keyPrefix: key, points, duration }));
  }
  return limiters.get(key)!;
}

/**
 * Clear all rate limiters (for test cleanup)
 * This removes all limiter instances, forcing new ones to be created with fresh state
 */
export function clearRateLimiters(): void {
  // RateLimiterMemory doesn't expose a method to delete all keys,
  // but clearing the map and creating new instances ensures fresh state
  // The internal state is stored per instance, so new instances = fresh state
  limiters.clear();
}

/**
 * Apply a per-IP rate limit with secure IP extraction.
 * Prevents X-Forwarded-For header spoofing (OWASP A07:2021).
 *
 * Example: app.post('/login', rateLimit('login', 5, 60), handler)
 *
 * @param key - Rate limiter key prefix
 * @param points - Maximum requests allowed
 * @param duration - Time window in seconds
 */
export function rateLimit(key: string, points = 60, duration = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Look up per request so clearRateLimiters() can replace the instance
    const limiter = getLimiter(key, points, duration);
    const ip = extractClientIpForRateLimit(req);
    limiter
      .consume(ip)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) => {
        // Calculate retry-after in seconds
        const retryAfter = Math.ceil((rejRes.msBeforeNext || duration * 1000) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
            requestId: res.locals.requestId,
            retryAfter,
          },
        });
      });
  };
}

/**
 * Apply a rate limit keyed by the authenticated user id with secure IP extraction.
 * Falls back to IP-based limiting if the user context is absent.
 * Prevents X-Forwarded-For header spoofing (OWASP A07:2021).
 *
 * @param key - Rate limiter key prefix
 * @param points - Maximum requests allowed
 * @param duration - Time window in seconds
 */
export function rateLimitByUser(key: string, points = 60, duration = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Look up per request so clearRateLimiters() can replace the instance
    const limiter = getLimiter(`${key}:user`, points, duration);
    const userId = req.user?.sub;
    const fallbackIp = extractClientIpForRateLimit(req);
    const identity = userId ? `user:${userId}` : fallbackIp;

    limiter
      .consume(identity)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) => {
        // Calculate retry-after in seconds
        const retryAfter = Math.ceil((rejRes.msBeforeNext || duration * 1000) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
            requestId: res.locals.requestId,
            retryAfter,
          },
        });
      });
  };
}

/**
 * Apply rate limiting by both IP address and email address.
 * Used for contact form submissions to prevent abuse from both perspectives.
 * Limits by IP and email independently - if either limit is exceeded, the request is rejected.
 *
 * @param key - Rate limiter key prefix
 * @param points - Maximum requests allowed
 * @param duration - Time window in seconds
 */
export function rateLimitByIPAndEmail(key: string, points = 5, duration = 3600) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ipLimiter = getLimiter(`${key}:ip`, points, duration);
    const emailLimiter = getLimiter(`${key}:email`, points, duration);
    const ip = extractClientIpForRateLimit(req);
    const email =
      typeof req.body === "object" && req.body !== null && "email" in req.body
        ? (req.body as { email?: unknown }).email
        : undefined;

    let normalizedEmail: string | null = null;
    if (email && typeof email === "string") {
      const trimmed = email.trim().toLowerCase();
      if (trimmed.includes("@") && trimmed.length > 0) {
        normalizedEmail = trimmed;
      }
    }

    const ipPromise = ipLimiter.consume(ip);
    const emailPromise = normalizedEmail
      ? emailLimiter.consume(`email:${normalizedEmail}`)
      : Promise.resolve();

    Promise.all([ipPromise, emailPromise])
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) => {
        const retryAfter = Math.ceil((rejRes.msBeforeNext || duration * 1000) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many contact form submissions. Please try again later.",
            requestId: res.locals.requestId,
            retryAfter,
          },
        });
      });
  };
}


/**
 * Apply a policy resolved at request time. Used for governed limits whose
 * values are loaded after application modules are imported.
 */
export function rateLimitFromPolicy(
  key: string,
  getPolicy: () => { points: number; duration: number },
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const policy = getPolicy();
    const limiter = getLimiter(key, policy.points, policy.duration);
    const ip = extractClientIpForRateLimit(req);
    limiter
      .consume(ip)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) => {
        const retryAfter = Math.ceil(
          (rejRes.msBeforeNext || policy.duration * 1000) / 1000,
        );
        res.setHeader("Retry-After", retryAfter.toString());
        res.status(429).json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests",
            requestId: res.locals.requestId,
            retryAfter,
          },
        });
      });
  };
}
