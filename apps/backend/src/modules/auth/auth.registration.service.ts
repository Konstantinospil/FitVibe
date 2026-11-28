import crypto from "crypto";
import { hashPassword } from "./password-hashing.service.js";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { db } from "../../db/connection.js";
import { acceptLegalDocumentVersion, getCurrentLegalPublication } from "../legal/legal.service.js";
import { HttpError } from "../../utils/http.js";
import { mailerService } from "../../services/mailer.service.js";
import {
  generateRegistrationAttemptEmailHtml,
  generateRegistrationAttemptEmailText,
  generateRegistrationContinueEmailHtml,
  generateRegistrationContinueEmailText,
  generateResendVerificationEmailHtml,
  generateResendVerificationEmailText,
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
import type { CompleteRegistrationDTO, StartRegistrationDTO, UserSafe } from "./auth.types.js";
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
import {
  consumeOpenRegistrationLinks,
  consumeRegistrationIntent,
  countRegistrationIntentsSince,
  findOpenRegistrationIntent,
  insertRegistrationIntent,
  type RegistrationIntentRecord,
} from "./auth.registration-intent.repository.js";
import { queueService } from "../../jobs/services/queue.factory.js";
import { hashRegistrationEmail, normalizeRegistrationEmail } from "./auth.registration-email.js";

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

// ---------------------------------------------------------------------------
// Email-first registration (ADR-039)
//
// 1. startRegistration: the HTTP request only validates the address and queues
//    a job. It reads no account data, so its answer and timing cannot depend
//    on whether the address is registered.
// 2. dispatchRegistrationRequest (background job): throttles per address,
//    then emails either a continue link (new address), a "you already have an
//    account" notice (active account), or a verification link (pending
//    account created by an administrator).
// 3. getRegistrationIntent / completeRegistration: the link holder has proved
//    they own the mailbox, so explicit errors (taken username, ...) are safe.
//    The account is created active and verified, in one transaction.
// ---------------------------------------------------------------------------

export const REGISTRATION_DISPATCH_JOB = "auth.registration.dispatch";

/** Requests per address per window, counted the same for every address. */
export const REGISTRATION_REQUESTS_PER_WINDOW = 3;
const REGISTRATION_THROTTLE_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_UNIQUE_CONSTRAINT = "idx_user_contacts_email_value";
const ALIAS_UNIQUE_CONSTRAINT = "profiles_alias_unique";

export type RegistrationDispatchOutcome =
  | "continue_link"
  | "existing_account_notice"
  | "pending_verification_link"
  | "no_email"
  | "throttled";

export { hashRegistrationEmail, normalizeRegistrationEmail };

function hashRegistrationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function usernameTaken(): HttpError {
  return new HttpError(409, "USER_USERNAME_TAKEN", "USER_USERNAME_TAKEN");
}

function invalidRegistrationLink(): HttpError {
  return new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
}

function expiredRegistrationLink(): HttpError {
  return new HttpError(410, "AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_EXPIRED");
}

function isExpired(record: RegistrationIntentRecord, now = Date.now()): boolean {
  return new Date(record.expires_at).getTime() <= now;
}

function uniqueConflict(error: unknown): "email" | "alias" | null {
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
 * Step 1. Queue the request and return. Validation errors (malformed address)
 * do not depend on account state; everything else happens in the job.
 */
export async function startRegistration(dto: StartRegistrationDTO): Promise<void> {
  const startTime = Date.now();
  try {
    await queueService.enqueue({
      name: REGISTRATION_DISPATCH_JOB,
      payload: {
        email: normalizeRegistrationEmail(dto.email),
        locale: dto.locale ?? null,
      },
      sensitive: true,
    });
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

async function sendContinueLink(email: string, token: string, locale?: string | null) {
  const continueUrl = `${env.frontendUrl}/register/complete?token=${token}`;
  const expiresInMinutes = Math.floor(emailVerificationTtlSeconds() / SECONDS_PER_MINUTE);
  await mailerService.send({
    to: email,
    subject: getEmailTranslations(locale).registrationContinue.subject,
    html: generateRegistrationContinueEmailHtml(continueUrl, expiresInMinutes, locale),
    text: generateRegistrationContinueEmailText(continueUrl, expiresInMinutes, locale),
  });
}

async function sendExistingAccountNotice(email: string, locale?: string | null) {
  const loginUrl = `${env.frontendUrl}/login`;
  const resetUrl = `${env.frontendUrl}/forgot-password`;
  await mailerService.send({
    to: email,
    subject: getEmailTranslations(locale).registrationAttempt.subject,
    html: generateRegistrationAttemptEmailHtml(loginUrl, resetUrl, locale),
    text: generateRegistrationAttemptEmailText(loginUrl, resetUrl, locale),
  });
}

async function sendPendingVerificationLink(
  user: { id: string; locale?: string | null },
  email: string,
) {
  let token: string;
  try {
    token = await issueAuthToken(
      user.id,
      TOKEN_TYPES.EMAIL_VERIFICATION,
      emailVerificationTtlSeconds(),
    );
  } catch (error) {
    // The per-account verification cap (AC-1.8) stops the email. Nobody waits
    // on this job, so there is no response that could reveal it.
    if (error instanceof HttpError && error.code === "AUTH_TOO_MANY_REQUESTS") {
      return false;
    }
    throw error;
  }
  const verificationUrl = `${env.frontendUrl}/verify?token=${token}`;
  const expiresInMinutes = Math.floor(emailVerificationTtlSeconds() / SECONDS_PER_MINUTE);
  await mailerService.send({
    to: email,
    subject: getEmailTranslations(user.locale).resend.subject,
    html: generateResendVerificationEmailHtml(verificationUrl, expiresInMinutes, user.locale),
    text: generateResendVerificationEmailText(verificationUrl, expiresInMinutes, user.locale),
  });
  return true;
}

/**
 * Step 1, background half. Runs in the job worker, never in the request.
 */
export async function dispatchRegistrationRequest(
  payload: Record<string, unknown>,
): Promise<RegistrationDispatchOutcome> {
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("Invalid registration dispatch payload");
  }
  const email = normalizeRegistrationEmail(payload.email);
  const requestLocale = typeof payload.locale === "string" ? payload.locale : null;
  const emailHash = hashRegistrationEmail(email);
  const now = new Date();

  const windowStart = new Date(now.getTime() - REGISTRATION_THROTTLE_WINDOW_MS);
  if (
    (await countRegistrationIntentsSince(emailHash, windowStart)) >=
    REGISTRATION_REQUESTS_PER_WINDOW
  ) {
    return "throttled";
  }

  const throttleOnlyRow = {
    id: uuidv4(),
    email_hash: emailHash,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + REGISTRATION_THROTTLE_WINDOW_MS).toISOString(),
  };

  if (await isEmailBlacklisted(email)) {
    await insertRegistrationIntent(throttleOnlyRow);
    return "no_email";
  }

  const existing = await findUserByEmail(email);
  if (!existing) {
    await consumeOpenRegistrationLinks(emailHash, now);
    const token = crypto
      .randomBytes(AUTH_SECURITY_POLICY.linkToken.randomBytes)
      .toString("base64url");
    await insertRegistrationIntent({
      ...throttleOnlyRow,
      email,
      token_hash: hashRegistrationToken(token),
      locale: requestLocale,
      expires_at: new Date(now.getTime() + emailVerificationTtlSeconds() * 1000).toISOString(),
    });
    await sendContinueLink(email, token, requestLocale);
    return "continue_link";
  }

  await insertRegistrationIntent(throttleOnlyRow);
  if (existing.status === "active") {
    await sendExistingAccountNotice(email, existing.locale);
    return "existing_account_notice";
  }
  if (existing.status === "pending_verification") {
    return (await sendPendingVerificationLink(existing, email))
      ? "pending_verification_link"
      : "no_email";
  }
  // Suspended, banned or pending deletion: nothing the owner can act on here.
  return "no_email";
}

/**
 * Step 2a. Let the completion page show which address it is finishing.
 * Only the holder of the emailed link can call this successfully.
 */
export async function getRegistrationIntent(
  token: string,
): Promise<{ email: string; expiresAt: string }> {
  const startTime = Date.now();
  try {
    const record = await findOpenRegistrationIntent(hashRegistrationToken(token));
    if (!record?.email) {
      throw invalidRegistrationLink();
    }
    if (isExpired(record)) {
      throw expiredRegistrationLink();
    }
    return { email: record.email, expiresAt: new Date(record.expires_at).toISOString() };
  } finally {
    await normalizeAuthTiming(startTime);
  }
}

/**
 * Step 2b. Create the account for the link holder: active, email verified,
 * terms accepted, link consumed, all in one transaction (ADR-036).
 */
export async function completeRegistration(
  dto: CompleteRegistrationDTO,
  preparedAvatar?: Buffer,
): Promise<{
  user: UserSafe;
  passwordWarning?: "PASSWORD_BREACHED" | "BREACH_CHECK_UNAVAILABLE";
}> {
  const startTime = Date.now();

  try {
    const tokenHash = hashRegistrationToken(dto.token);
    const intent = await findOpenRegistrationIntent(tokenHash);
    if (!intent?.email) {
      throw invalidRegistrationLink();
    }
    if (isExpired(intent)) {
      throw expiredRegistrationLink();
    }
    const email = intent.email;
    if (await isEmailBlacklisted(email)) {
      await consumeRegistrationIntent(intent.id);
      throw invalidRegistrationLink();
    }

    if (!dto.terms_accepted) {
      throw new HttpError(400, "TERMS_ACCEPTANCE_REQUIRED", "TERMS_ACCEPTANCE_REQUIRED");
    }
    const alias = (dto.alias ?? dto.username ?? "").trim();
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

    // The caller owns this mailbox, and aliases are public: say so plainly.
    if (await findUserByUsername(alias)) {
      throw usernameTaken();
    }

    const id = uuidv4();
    const password_hash = await hashPassword(dto.password);
    const now = new Date().toISOString();
    const currentTerms = await getCurrentLegalPublication("terms");

    let persistedAvatar: PersistedRegistrationAvatar | null = null;
    try {
      await db.transaction(async (trx) => {
        // Lock the link so two submissions of it cannot both create accounts.
        const locked = await findOpenRegistrationIntent(tokenHash, trx, { forUpdate: true });
        if (!locked?.email) {
          throw invalidRegistrationLink();
        }
        if (isExpired(locked)) {
          throw expiredRegistrationLink();
        }

        await createUser(
          {
            id,
            alias,
            display_name: dto.profile?.display_name ?? alias,
            status: "active",
            role_code: "athlete",
            password_hash,
            primaryEmail: locked.email,
            emailVerified: true,
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
        await consumeRegistrationIntent(locked.id, trx);
      });
    } catch (error) {
      await cleanupRegistrationAvatar(persistedAvatar);
      const conflict = uniqueConflict(error);
      if (conflict === "alias") {
        throw usernameTaken();
      }
      if (conflict === "email") {
        // An account for this address appeared after the link was sent (for
        // example created by an administrator). The caller owns the mailbox.
        throw new HttpError(409, "AUTH_EMAIL_ALREADY_REGISTERED", "AUTH_EMAIL_ALREADY_REGISTERED");
      }
      throw error;
    }

    if (persistedAvatar) {
      await auditRegistrationAvatar(id, persistedAvatar);
    }

    const user = await findUserById(id);
    if (!user) {
      throw new HttpError(500, "AUTH_REGISTRATION_FAILED", "AUTH_REGISTRATION_FAILED");
    }
    return { user: toSafeUser(user), passwordWarning };
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
