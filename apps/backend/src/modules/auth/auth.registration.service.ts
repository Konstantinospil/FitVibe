import crypto from "crypto";
import { hashPassword } from "./password-hashing.service.js";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { acceptLegalDocumentVersion, getCurrentLegalPublication } from "../legal/legal.service.js";
import { HttpError } from "../../utils/http.js";
import { mailerService } from "../../services/mailer.service.js";
import {
  generateVerificationEmailHtml,
  generateVerificationEmailText,
  generateResendVerificationEmailHtml,
  generateResendVerificationEmailText,
  generateRegistrationAttemptEmailHtml,
  generateRegistrationAttemptEmailText,
  getEmailTranslations,
} from "../../services/i18n.service.js";
import { normalizeAuthTiming } from "./timing.utils.js";
import { assertPasswordPolicy } from "./passwordPolicy.js";
import { breachedPasswordChecker } from "./breached-password.service.js";
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
import {
  auditRegistrationAvatar,
  cleanupRegistrationAvatar,
  persistRegistrationAvatar,
  type PersistedRegistrationAvatar,
} from "./auth.registration-avatar.service.js";
import { assertRegistrationReferenceValues } from "./auth.registration-options.service.js";

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

const EMAIL_UNIQUE_CONSTRAINT = "idx_user_contacts_email_value";
const ALIAS_UNIQUE_CONSTRAINT = "profiles_alias_unique";

function usernameTaken(): HttpError {
  return new HttpError(409, "USER_USERNAME_TAKEN", "USER_USERNAME_TAKEN");
}

/**
 * Classify a PostgreSQL unique violation (23505) raised while creating the
 * account. Returns null for any other error so it propagates unchanged.
 */
function registrationUniqueConflict(error: unknown): "email" | "alias" | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== "23505") {
    return null;
  }
  if (constraint === EMAIL_UNIQUE_CONSTRAINT) {
    return "email";
  }
  if (constraint === ALIAS_UNIQUE_CONSTRAINT) {
    return "alias";
  }
  return null;
}

/**
 * Tell the owner of an existing account that someone tried to register with
 * their address. Only active accounts are told: they are the ones who can act
 * on "sign in or reset your password", matching the forgot-password flow.
 */
async function notifyExistingAccountOwner(
  status: string,
  email: string,
  locale?: string | null,
): Promise<void> {
  if (status !== "active" || !env.email.enabled) {
    return;
  }
  const loginUrl = `${env.frontendUrl}/login`;
  const resetUrl = `${env.frontendUrl}/forgot-password`;
  const t = getEmailTranslations(locale);
  await mailerService.send({
    to: email,
    subject: t.registrationAttempt.subject,
    html: generateRegistrationAttemptEmailHtml(loginUrl, resetUrl, locale),
    text: generateRegistrationAttemptEmailText(loginUrl, resetUrl, locale),
  });
}

export async function register(
  dto: RegisterDTO,
  preparedAvatar?: Buffer,
): Promise<{
  verificationToken?: string;
  user?: UserSafe;
  passwordWarning?: "PASSWORD_BREACHED" | "BREACH_CHECK_UNAVAILABLE";
}> {
  const startTime = Date.now();

  try {
    const email = dto.email.toLowerCase();
    const alias = (dto.alias ?? dto.username ?? "").trim();
    if (await isEmailBlacklisted(email)) {
      throw new HttpError(403, "AUTH_EMAIL_BLOCKED", "AUTH_EMAIL_BLOCKED");
    }
    assertPasswordPolicy(dto.password, { email, alias });
    // Keep the local common-password denylist mandatory. A breach match or
    // provider outage is advisory and must not prevent account creation.
    const passwordWarning = await breachedPasswordChecker.checkAdvisory(dto.password);
    if (
      dto.profile?.sex !== undefined ||
      dto.profile?.fitness_level !== undefined ||
      dto.profile?.weight_kg !== undefined
    ) {
      await assertRegistrationReferenceValues({
        gender: dto.profile?.sex,
        fitnessLevel: dto.profile?.fitness_level ?? undefined,
        weightKg: dto.profile?.weight_kg ?? undefined,
      });
    }

    // Every request-shape check runs before any existence lookup, so its outcome
    // can never depend on whether the email is registered.
    if (!dto.terms_accepted) {
      throw new HttpError(400, "TERMS_ACCEPTANCE_REQUIRED", "TERMS_ACCEPTANCE_REQUIRED");
    }

    // Hash on every path (new, existing, pending, conflict) so the expensive
    // step cannot separate them by timing.
    const password_hash = await hashPassword(dto.password);

    // Aliases are public, so a taken alias may be reported. It is checked before
    // and independently of the email, so the answer is the same for every email.
    if (await findUserByUsername(alias)) {
      throw usernameTaken();
    }

    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      if (existingByEmail.status === "pending_verification") {
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

        return { verificationToken: token, user: toSafeUser(existingByEmail), passwordWarning };
      }
      // The email belongs to an existing account: answer exactly like a new
      // signup and tell only the owner, through the mailbox they control.
      await notifyExistingAccountOwner(existingByEmail.status, email, existingByEmail.locale);
      return { passwordWarning };
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const currentTerms = await getCurrentLegalPublication("terms");

    let persistedAvatar: PersistedRegistrationAvatar | null = null;
    try {
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

        if (preparedAvatar) {
          persistedAvatar = await persistRegistrationAvatar(id, preparedAvatar, trx);
        }

        await acceptLegalDocumentVersion(id, currentTerms.id, "registration", trx);
      });
    } catch (error) {
      await cleanupRegistrationAvatar(persistedAvatar);
      // A concurrent registration can pass the pre-checks and lose the insert
      // race. The transaction has rolled back, so nothing partial remains.
      const conflict = registrationUniqueConflict(error);
      if (conflict === "email") {
        return { passwordWarning };
      }
      if (conflict === "alias") {
        throw usernameTaken();
      }
      throw error;
    }

    if (persistedAvatar) {
      await auditRegistrationAvatar(id, persistedAvatar);
    }

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
    return { verificationToken, user: user ? toSafeUser(user) : undefined, passwordWarning };
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
