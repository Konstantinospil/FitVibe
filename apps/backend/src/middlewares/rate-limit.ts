import { RateLimiterMemory } from "rate-limiter-flexible";
import type { NextFunction, Request, Response } from "express";
import { extractClientIpForRateLimit } from "../utils/ip-extractor.js";
import { getRouteRateLimitPolicy, type RateLimitPolicy } from "./rate-limit.policy.js";

const limiters = new Map<string, RateLimiterMemory>();

function getLimiter(key: string, points: number, duration: number): RateLimiterMemory {
  const cacheKey = `${key}:${points}:${duration}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new RateLimiterMemory({ keyPrefix: key, points, duration });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

function resolvePolicy(key: string, points?: number, duration?: number): RateLimitPolicy {
  if (points === undefined && duration === undefined) {
    return getRouteRateLimitPolicy(key);
  }
  if (points === undefined || duration === undefined) {
    throw new Error(`Rate-limit overrides require both points and duration for ${key}`);
  }
  return { points, duration };
}

function rejectRateLimited(
  res: Response,
  duration: number,
  rejRes: { msBeforeNext?: number },
  message = "Too many requests",
): void {
  const retryAfter = Math.ceil((rejRes.msBeforeNext || duration * 1000) / 1000);
  res.setHeader("Retry-After", retryAfter.toString());
  res.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message,
      requestId: res.locals.requestId,
      retryAfter,
    },
  });
}

export function clearRateLimiters(): void {
  limiters.clear();
}

export function rateLimit(key: string, points?: number, duration?: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const policy = resolvePolicy(key, points, duration);
    const limiter = getLimiter(key, policy.points, policy.duration);
    const ip = extractClientIpForRateLimit(req);
    limiter
      .consume(ip)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) =>
        rejectRateLimited(res, policy.duration, rejRes),
      );
  };
}

export function rateLimitByUser(key: string, points?: number, duration?: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const policy = resolvePolicy(key, points, duration);
    const limiter = getLimiter(`${key}:user`, policy.points, policy.duration);
    const userId = req.user?.sub;
    const fallbackIp = extractClientIpForRateLimit(req);
    const identity = userId ? `user:${userId}` : fallbackIp;

    limiter
      .consume(identity)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) =>
        rejectRateLimited(res, policy.duration, rejRes),
      );
  };
}

export function rateLimitByIPAndEmail(key: string, points?: number, duration?: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const policy = resolvePolicy(key, points, duration);
    const ipLimiter = getLimiter(`${key}:ip`, policy.points, policy.duration);
    const emailLimiter = getLimiter(`${key}:email`, policy.points, policy.duration);
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
      .catch((rejRes: { msBeforeNext?: number }) =>
        rejectRateLimited(
          res,
          policy.duration,
          rejRes,
          "Too many contact form submissions. Please try again later.",
        ),
      );
  };
}

/** Apply a runtime-governed policy without capturing it during module import. */
export function rateLimitFromPolicy(key: string, getPolicy: () => RateLimitPolicy) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const policy = getPolicy();
    const limiter = getLimiter(key, policy.points, policy.duration);
    const ip = extractClientIpForRateLimit(req);
    limiter
      .consume(ip)
      .then(() => next())
      .catch((rejRes: { msBeforeNext?: number }) =>
        rejectRateLimited(res, policy.duration, rejRes),
      );
  };
}
