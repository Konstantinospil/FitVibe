/**
 * Timing normalization utility for preventing user enumeration attacks (AC-1.12)
 *
 * This module provides utilities to ensure authentication operations take
 * similar amounts of time regardless of whether a user exists or not,
 * preventing timing-based user enumeration attacks.
 *
 * Target: Timing variance ≤10% between valid/invalid user operations
 */

import crypto from "crypto";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";

/**
 * Minimum time (in milliseconds) that authentication operations should take.
 * This ensures both success and failure paths take similar time.
 *
 * Based on typical bcrypt comparison time (~100-200ms for cost=12)
 * plus JWT signing operations (~20-60ms total) plus additional buffer
 * for timing normalization to account for system variance and concurrent load.
 *
 * Higher values provide better protection against timing attacks but increase
 * response time. 300ms balances security with acceptable UX while providing
 * sufficient buffer for normalization under varying system load conditions.
 */
const MIN_AUTH_OPERATION_TIME_MS = AUTH_SECURITY_POLICY.timing.minOperationMs;

/**
 * Add randomized delay to normalize timing across different code paths.
 * This prevents attackers from using timing differences to determine
 * if a user exists.
 *
 * @param startTime - When the operation started (from Date.now())
 * @param minTime - Minimum time the operation should take (default: 150ms)
 */
export async function normalizeAuthTiming(
  startTime: number,
  minTime: number = MIN_AUTH_OPERATION_TIME_MS,
): Promise<void> {
  const elapsed = Date.now() - startTime;
  const remaining = minTime - elapsed;

  if (remaining > 0) {
    // Add small random jitter (±10ms) to prevent statistical timing attacks
    const jitterMs = AUTH_SECURITY_POLICY.timing.jitterMs;
    const jitter = crypto.randomInt(-jitterMs, jitterMs + 1);
    const delay = Math.max(0, remaining + jitter);
    await sleep(delay);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function and ensure it takes at least the minimum time.
 * This is a convenience wrapper around normalizeAuthTiming.
 *
 * @param fn - Async function to execute
 * @param minTime - Minimum time the operation should take
 * @returns Result of the function
 */
export async function withNormalizedTiming<T>(
  fn: () => Promise<T>,
  minTime: number = MIN_AUTH_OPERATION_TIME_MS,
): Promise<T> {
  const startTime = Date.now();
  try {
    return await fn();
  } finally {
    await normalizeAuthTiming(startTime, minTime);
  }
}

/**
 * Constants for timing normalization
 */
export const TIMING_CONSTANTS = {
  MIN_AUTH_OPERATION_TIME_MS,
  /**
   * Target variance threshold for AC-1.12: ≤10%
   */
  MAX_VARIANCE_PERCENT: AUTH_SECURITY_POLICY.timing.maxVariancePercent,
} as const;
