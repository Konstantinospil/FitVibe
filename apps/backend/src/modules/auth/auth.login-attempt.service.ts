import { db } from "../../db/index.js";
import {
  getFailedAttempt,
  recordFailedAttempt,
  resetFailedAttempts,
  isAccountLocked,
  getRemainingLockoutSeconds,
  getFailedAttemptByIP,
  recordFailedAttemptByIP,
  isIPLocked,
  getRemainingIPLockoutSeconds,
  lockLoginAttemptIp,
} from "./bruteforce.repository.js";
import { recordAuthAuditEvent as recordAuditEvent } from "./auth.audit.js";

/**
 * Decide whether the caller may proceed to real credential verification.
 *
 * A throttle is deliberately NOT exposed as a distinct HTTP result. Returning
 * a visible 429 only for failed-password histories would let an attacker test
 * whether a guessed password was correct on a 2FA-protected account. The login
 * service instead performs decoy work and returns the normal opaque pre-auth
 * challenge whenever this function returns false.
 */
export async function assertLoginAllowed(
  identifier: string,
  ipAddress: string,
  requestId: string | null,
): Promise<boolean> {
  const ipAttempt = await getFailedAttemptByIP(ipAddress);
  if (isIPLocked(ipAttempt)) {
    const remainingSeconds = getRemainingIPLockoutSeconds(ipAttempt);
    await recordAuditEvent(null, "auth.login_blocked_ip", {
      ip: ipAddress,
      remainingSeconds,
      totalAttemptCount: ipAttempt?.total_attempt_count ?? 0,
      distinctEmailCount: ipAttempt?.distinct_email_count ?? 0,
      requestId,
    });
    return false;
  }

  const accountAttempt = await getFailedAttempt(identifier, ipAddress);
  if (isAccountLocked(accountAttempt)) {
    const remainingSeconds = getRemainingLockoutSeconds(accountAttempt);
    await recordAuditEvent(null, "auth.login_blocked", {
      identifier,
      ip: ipAddress,
      remainingSeconds,
      attemptCount: accountAttempt?.attempt_count ?? 0,
      requestId,
    });
    return false;
  }

  return true;
}

/**
 * Record password failure state without exposing the counter state to the
 * unauthenticated caller. Threshold crossings are audit/security state only;
 * the caller continues to receive the same opaque pre-authentication response.
 */
export async function recordLoginFailure({
  identifier,
  ipAddress,
  userAgent,
  actorUserId,
  requestId,
}: {
  identifier: string;
  ipAddress: string;
  userAgent: string | null;
  actorUserId: string | null;
  requestId: string | null;
}): Promise<void> {
  const attempts = await db.transaction(async (trx) => {
    await lockLoginAttemptIp(ipAddress, trx);
    const account = await recordFailedAttempt(identifier, ipAddress, userAgent, trx);
    const ip = await recordFailedAttemptByIP(ipAddress, identifier, trx);
    return { account, ip };
  });

  if (isIPLocked(attempts.ip)) {
    await recordAuditEvent(actorUserId, "auth.login_blocked_ip", {
      ip: ipAddress,
      remainingSeconds: getRemainingIPLockoutSeconds(attempts.ip),
      totalAttemptCount: attempts.ip.total_attempt_count,
      distinctEmailCount: attempts.ip.distinct_email_count,
      requestId,
    });
  }

  if (isAccountLocked(attempts.account)) {
    await recordAuditEvent(actorUserId, "auth.login_blocked", {
      identifier,
      ip: ipAddress,
      remainingSeconds: getRemainingLockoutSeconds(attempts.account),
      attemptCount: attempts.account.attempt_count,
      requestId,
    });
  }

  if (actorUserId) {
    await recordAuditEvent(actorUserId, "auth.login_failed", {
      ip: ipAddress,
      attemptCount: attempts.account.attempt_count,
      lockedUntil: attempts.account.locked_until,
      requestId,
    });
  }
}

export async function resetLoginFailures(identifier: string, ipAddress: string): Promise<void> {
  await resetFailedAttempts(identifier, ipAddress);
}
