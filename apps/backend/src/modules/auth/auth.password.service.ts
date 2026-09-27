import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
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
import { issueAuthToken, TOKEN_TYPES } from "./auth.tokens.service.js";
import { isEmailBlacklisted } from "../common/email-blacklist.repository.js";

const PASSWORD_RESET_TTL = env.PASSWORD_RESET_TTL_SEC;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("fitvibe-placeholder-password", 12);

export async function requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
  const startTime = Date.now();

  try {
    const normalized = email.toLowerCase();
    const blocked = await isEmailBlacklisted(normalized);
    const user = await findUserByEmail(normalized);
    if (blocked || !user || user.status !== "active") {
      await bcrypt.compare("dummy-password", DUMMY_PASSWORD_HASH);
      return {};
    }

    const resetToken = await issueAuthToken(
      user.id,
      TOKEN_TYPES.PASSWORD_RESET,
      PASSWORD_RESET_TTL,
    );

    if (env.email.enabled) {
      const resetUrl = `${env.frontendUrl}/reset-password?token=${resetToken}`;
      await mailerService.send({
        to: email,
        subject: "Reset your FitVibe password",
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            This link will expire in ${Math.floor(PASSWORD_RESET_TTL / 60)} minutes.
          </p>
          <p style="color: #999; font-size: 12px;">
            If you didn't request this password reset, you can safely ignore this email.
          </p>
        </div>
      `,
        text: `Password Reset Request\n\nWe received a request to reset your password. Please visit the following link to create a new password:\n\n${resetUrl}\n\nThis link will expire in ${Math.floor(PASSWORD_RESET_TTL / 60)} minutes.\n\nIf you didn't request this password reset, you can safely ignore this email.`,
      });
    }

    return { resetToken };
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await findAuthToken(TOKEN_TYPES.PASSWORD_RESET, tokenHash);
  if (!record) {
    throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await consumeAuthToken(record.id);
    throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
  }

  const user = await findUserById(record.user_id);
  if (!user) {
    throw new HttpError(404, "AUTH_USER_NOT_FOUND", "AUTH_USER_NOT_FOUND");
  }
  if (!user.primary_email || (await isEmailBlacklisted(user.primary_email))) {
    await consumeAuthToken(record.id);
    throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
  }

  assertPasswordPolicy(newPassword, {
    email: user.primary_email ?? undefined,
    alias: user.username,
  });

  const password_hash = await bcrypt.hash(newPassword, 12);
  const resetApplied = await resetPasswordAtomic(
    record.user_id,
    password_hash,
    record.id,
    TOKEN_TYPES.PASSWORD_RESET,
  );
  if (!resetApplied) {
    throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
  }
}
