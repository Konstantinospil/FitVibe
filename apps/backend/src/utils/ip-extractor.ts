/**
 * Secure client-IP extraction for authentication and rate limiting.
 *
 * X-Forwarded-For is accepted in the test environment or when proxy mode is
 * explicitly enabled and the immediate TCP peer is allowlisted. Direct
 * clients cannot opt themselves into proxy semantics by sending the header.
 */

import { isIP } from "node:net";
import type { Request } from "express";
import { env } from "../config/env.js";

function isValidIP(ip: string): boolean {
  return isIP(ip) !== 0;
}

function socketAddress(req: Request): string | null {
  const candidate = req.socket?.remoteAddress || req.ip;
  return candidate && isValidIP(candidate) ? candidate : null;
}

function canTrustForwardedFor(req: Request): boolean {
  const isTestEnv = env.NODE_ENV === "test" && !env.isProduction;
  if (isTestEnv) {
    return true;
  }

  const peer = socketAddress(req);
  const trustedProxyIps = env.trustedProxyIps ?? [];
  return Boolean(env.trustProxy && peer && trustedProxyIps.includes(peer));
}

export function extractClientIp(req: Request): string {
  if (canTrustForwardedFor(req)) {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (forwardedFor && typeof forwardedFor === "string") {
      const clientIp = forwardedFor
        .split(",")
        .map((ip) => ip.trim())
        .find((ip) => ip.length > 0);

      if (clientIp && isValidIP(clientIp)) {
        return clientIp;
      }
    }
  }

  return socketAddress(req) ?? "unknown";
}

export function extractClientIpForRateLimit(req: Request): string {
  return extractClientIp(req);
}
