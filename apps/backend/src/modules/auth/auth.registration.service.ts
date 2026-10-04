import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { db } from "../../db/connection.js";
import { acceptLegalDocumentVersion, getCurrentLegalPublication } from "../legal/legal.service.js";
import { HttpError } from "../../utils/http.js";
import { mailerService } from "../../services/mailer.service.js";
import {
  generateVerificationEmailHtml,
  generateVerificationEmailText,
  generateResendVerificationEmailHtml,
  generateResendVerificationEmailText,
  getEmailTranslations,
} from "../../services/i18n.service.js";
import { normalizeAuthTiming } from "./timing.utils.js";
import { assertPasswordPolicy } from "./passwordPolicy.js";
import {
  consumeAuthToken,
  createUser,
  findAuthToken,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  markAuthTokensConsumed,
  markEmailVerified,
  updateUserStatus,
} from "./auth.repository.js";
import type { RegisterDTO, UserSafe } from "./auth.types.js";
import { issueAuthToken, TOKEN_TYPES } from "./auth.tokens.service.js";
import { toSafeUser } from "./auth.mapping.js";
import { isEmailBlacklisted } from "../common/email-blacklist.repository.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";

const SECONDS_PER_MINUTE = 60;
function emailVerificationTtlSeconds(): number {
  return getRuntimeAppSetting<number>("auth.email_verification_ttl_minutes") * SECONDS_PER_MINUTE;
}

function dateOfBirthFromAge(age?: number | null): string | undefined {
  if (age === undefined || age === null) {
    return undefined;
  }
  const today = new Date();
  const birthDate = new Date(
    Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()),
  );
  return birthDate.toISOString().slice(0, 10);
}

export async function register(
  dto: RegisterDTO,
): Promise<{ verificationToken?: string; user?: UserSafe }> {
  const startTime = Date.now();

  try {
    const email = dto.email.toLowerCase();
    const alias = (dto.alias ?? dto.username ?? "").trim();
    if (await isEmailBlacklisted(email)) {
      throw new HttpError(403, "AUTH_EMAIL_BLOCKED", "AUTH_EMAIL_BLOCKED");
    }
    assertPasswordPolicy(dto.password, { email, alias });
    const existingByEmail = await findUserByEmail(email);
    const existingByUsername = await findUserByUsername(alias);

    if (existingByEmail || existingByUsername) {
      if (existingByEmail && existingByEmail.status === "pending_verification") {
        const token = await issueAuthToken(
          existingByEmail.id,
          TOKEN_TYPES.EMAIL_VERIFICATION,
          emailVerificationTtlSeconds(),
        );

        if (env.email.enabled) {
          const verificationUrl = `${env.frontendUrl}/verify?token=${token}`;
          const expiresInMinutes = Math.floor(emailVerificationTtlSeconds() / 60);
          const locale = existingByEmail.locale;
          const t = getEmailTranslations(locale);

          await mailerService.send({
            to: email,
            subject: t.resend.subject,
            html: generateResendVerificationEmailHtml(verificationUrl, expiresInMinutes, locale),
            text: generateResendVerificationEmailText(verificationUrl, expiresInMinutes, locale),
          });
        }

        return { verificationToken: token, user: toSafeUser(existingByEmail) };
      }
      throw new HttpError(409, "AUTH_CONFLICT", "AUTH_CONFLICT");
    }

    if (!dto.terms_accepted) {
      throw new HttpError(400, "TERMS_ACCEPTANCE_REQUIRED", "TERMS_ACCEPTANCE_REQUIRED");
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(dto.password, AUTH_SECURITY_POLICY.password.hashCost);
    const now = new Date().toISOString();
    const currentTerms = await getCurrentLegalPublication("terms");

    await db.transaction(async (trx) => {
      await createUser(
        {
          id,
          alias,
          display_name: dto.profile?.display_name ?? alias,
          status: "pending_verification",
          role_code: "athlete",
          password_hash,
          primaryEmail: email,
          terms_accepted: true,
          terms_accepted_at: now,
          terms_version: currentTerms.version,
          gender_code: dto.profile?.sex,
          fitness_level_code: dto.profile?.fitness_level ?? undefined,
          date_of_birth: dto.profile?.date_of_birth ?? dateOfBirthFromAge(dto.profile?.age),
          weight_kg: dto.profile?.weight_kg ?? undefined,
        },
        trx,
      );

      await acceptLegalDocumentVersion(id, currentTerms.id, "registration", trx);
    });

    const verificationToken = await issueAuthToken(
      id,
      TOKEN_TYPES.EMAIL_VERIFICATION,
      emailVerificationTtlSeconds(),
    );

    if (env.email.enabled) {
      const verificationUrl = `${env.frontendUrl}/verify?token=${verificationToken}`;
      const expiresInMinutes = Math.floor(emailVerificationTtlSeconds() / 60);

      const user = await findUserById(id);
      const locale = user?.locale;
      const t = getEmailTranslations(locale);

      await mailerService.send({
        to: email,
        subject: t.verification.subject,
        html: generateVerificationEmailHtml(verificationUrl, expiresInMinutes, locale),
        text: generateVerificationEmailText(verificationUrl, expiresInMinutes, locale),
      });
    }

    const user = await findUserById(id);
    return { verificationToken, user: user ? toSafeUser(user) : undefined };
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const startTime = Date.now();

  try {
    const normalizedEmail = email.toLowerCase();
    if (await isEmailBlacklisted(normalizedEmail)) {
      return;
    }
    const user = await findUserByEmail(normalizedEmail);

    if (user && user.status === "pending_verification") {
      const token = await issueAuthToken(
        user.id,
        TOKEN_TYPES.EMAIL_VERIFICATION,
        emailVerificationTtlSeconds(),
      );

      if (env.email.enabled) {
        const verificationUrl = `${env.frontendUrl}/verify?token=${token}`;
        const expiresInMinutes = Math.floor(emailVerificationTtlSeconds() / 60);
        const locale = user.locale;
        const t = getEmailTranslations(locale);

        await mailerService.send({
          to: normalizedEmail,
          subject: t.resend.subject,
          html: generateResendVerificationEmailHtml(verificationUrl, expiresInMinutes, locale),
          text: generateResendVerificationEmailText(verificationUrl, expiresInMinutes, locale),
        });
      }
    }
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

export async function verifyEmail(token: string): Promise<UserSafe> {
  const startTime = Date.now();

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await findAuthToken(TOKEN_TYPES.EMAIL_VERIFICATION, tokenHash);
    if (!record) {
      throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await consumeAuthToken(record.id);
      throw new HttpError(410, "AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_EXPIRED");
    }

    const preActivationUser = await findUserById(record.user_id);
    if (
      !preActivationUser?.primary_email ||
      (await isEmailBlacklisted(preActivationUser.primary_email))
    ) {
      await consumeAuthToken(record.id);
      throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
    }

    await consumeAuthToken(record.id);
    await updateUserStatus(record.user_id, "active");
    await markAuthTokensConsumed(record.user_id, TOKEN_TYPES.EMAIL_VERIFICATION);

    const user = await findUserById(record.user_id);
    if (!user) {
      throw new HttpError(404, "AUTH_USER_NOT_FOUND", "AUTH_USER_NOT_FOUND");
    }

    if (user.primary_email) {
      await markEmailVerified(record.user_id, user.primary_email);
    }

    return toSafeUser(user);
  } finally {
    await normalizeAuthTiming(startTime);
  }
}
