import crypto from "crypto";
import { hashPassword } from "./password-hashing.service.js";
import { env } from "../../config/env.js";
import { incrementAuthPasswordReset } from "../../observability/metrics.js";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { HttpError } from "../../utils/http.js";
import { mailerService } from "../../services/mailer.service.js";
import { normalizeAuthTiming } from "./timing.utils.js";
import {
  consumeAuthToken,
  findAuthToken,
  findUserByEmail,
  findUserById,
  resetPasswordAtomic,
} from "./auth.repository.js";
import { assertPasswordPolicy } from "./passwordPolicy.js";
import { breachedPasswordChecker } from "./breached-password.service.js";
import { issueAuthToken, TOKEN_TYPES } from "./auth.tokens.service.js";
import { isEmailBlacklisted } from "../common/email-blacklist.repository.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";
import { queueService } from "../../jobs/services/queue.factory.js";
import { EMAIL_STYLES } from "../../services/email.theme.js";

const SECONDS_PER_MINUTE = 60;
function passwordResetTtlSeconds(): number {
  return (
    Math.min(
      getRuntimeAppSetting<number>("auth.password_reset_ttl_minutes"),
      AUTH_SECURITY_POLICY.passwordReset.maxTtlMinutes,
    ) * SECONDS_PER_MINUTE
  );
}

export const PASSWORD_RESET_DISPATCH_JOB = "auth.password-reset.dispatch";

export type PasswordResetDispatchOutcome = "sent" | "no_email";

/**
 * Forgot-password request. Like registration (ADR-039) it only queues the
 * work: the request reads no account data, so its answer and timing are the
 * same whether or not the address has an account, and the reset link reaches
 * only the mailbox.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const startTime = Date.now();
  // Count all requests equally; existence must never affect public feedback.
  incrementAuthPasswordReset("requested");

  try {
    await queueService.enqueue({
      name: PASSWORD_RESET_DISPATCH_JOB,
      payload: { email: email.trim().toLowerCase() },
      sensitive: true,
    });
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

/**
 * Background half of the forgot-password request. Runs in the job worker.
 */
export async function dispatchPasswordReset(
  payload: Record<string, unknown>,
): Promise<PasswordResetDispatchOutcome> {
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("Invalid password reset dispatch payload");
  }
  const email = payload.email.trim().toLowerCase();
  if (await isEmailBlacklisted(email)) {
    return "no_email";
  }
  const user = await findUserByEmail(email);
  if (!user || user.status !== "active") {
    return "no_email";
  }

  const resetToken = await issueAuthToken(
    user.id,
    TOKEN_TYPES.PASSWORD_RESET,
    passwordResetTtlSeconds(),
  );

  const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;
  // Always hand the message to the mailer: it delivers over SMTP when enabled
  // and keeps it in the non-production test mailbox when capture is on.
  await mailerService.send({
    to: email,
    subject: "Reset your FitVibe password",
    html: `
      <div style="${EMAIL_STYLES.container}">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        <p>
          <a href="${resetUrl}" style="${EMAIL_STYLES.button}">
            Reset Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="${EMAIL_STYLES.rawLink}">${resetUrl}</p>
        <p style="${EMAIL_STYLES.footer}">
          This link will expire in ${Math.floor(passwordResetTtlSeconds() / 60)} minutes.
        </p>
        <p style="${EMAIL_STYLES.smallPrint}">
          If you didn't request this password reset, you can safely ignore this email.
        </p>
      </div>
      `,
    text: `Password Reset Request\n\nWe received a request to reset your password. Please visit the following link to create a new password:\n\n${resetUrl}\n\nThis link will expire in ${Math.floor(passwordResetTtlSeconds() / 60)} minutes.\n\nIf you didn't request this password reset, you can safely ignore this email.`,
  });
  return "sent";
}

function invalidResetToken(): HttpError {
  incrementAuthPasswordReset("invalid_token");
  return new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ passwordWarning?: "PASSWORD_BREACHED" | "BREACH_CHECK_UNAVAILABLE" }> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await findAuthToken(TOKEN_TYPES.PASSWORD_RESET, tokenHash);
  if (!record) {
    throw invalidResetToken();
  }
  if (
    new Date(record.expires_at).getTime() <= Date.now() ||
    !Number.isFinite(new Date(record.created_at).getTime()) ||
    new Date(record.created_at).getTime() +
      AUTH_SECURITY_POLICY.passwordReset.maxTtlMinutes * SECONDS_PER_MINUTE * 1000 <=
      Date.now()
  ) {
    await consumeAuthToken(record.id);
    throw invalidResetToken();
  }

  const user = await findUserById(record.user_id);
  if (!user || user.status !== "active") {
    throw invalidResetToken();
  }
  if (!user.primary_email || (await isEmailBlacklisted(user.primary_email))) {
    await consumeAuthToken(record.id);
    throw invalidResetToken();
  }

  assertPasswordPolicy(newPassword, {
    email: user.primary_email ?? undefined,
    alias: user.username,
    role: user.role_code,
  });
  // Common passwords are rejected, but breach matches and provider outages
  // are advisory. A warning never bypasses other password-policy checks.
  const passwordWarning = await breachedPasswordChecker.checkAdvisory(newPassword);

  const password_hash = await hashPassword(newPassword);
  const resetApplied = await resetPasswordAtomic(
    record.user_id,
    password_hash,
    record.id,
    TOKEN_TYPES.PASSWORD_RESET,
    newPassword,
  );
  if (!resetApplied) {
    throw invalidResetToken();
  }
  incrementAuthPasswordReset("completed");
  return { passwordWarning };
}
