import crypto from "crypto";
import { AUTH_SECURITY_POLICY } from "../../config/security-policy.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import {
  deleteContact,
  fetchUserWithContacts,
  getContactById,
  getUserContacts,
  markContactVerified,
  upsertContact,
} from "./users.repository.js";
import {
  consumeAuthToken,
  countAuthTokensSince,
  createAuthToken,
  findAuthToken,
  markAuthTokensConsumed,
  purgeAuthTokensOlderThan,
} from "../auth/auth.repository.js";
import { toContact, toUserDetail } from "./users.mapping.js";
import type { UserContact, UserDetail } from "./users.types.js";
import { isEmailBlacklisted } from "../common/email-blacklist.repository.js";
import { getRuntimeAppSetting } from "../system/app-settings.runtime.js";

const CONTACT_VERIFICATION_TOKEN_PREFIX = "contact_verify";
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

function contactVerificationTtlMilliseconds(): number {
  return getRuntimeAppSetting<number>("auth.email_verification_ttl_minutes") * MILLISECONDS_PER_MINUTE;
}

function contactTokenType(contactId: string): string {
  return `${CONTACT_VERIFICATION_TOKEN_PREFIX}:${contactId}`;
}

function generateContactToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" && maybeCode === "23505";
}

export async function listContacts(userId: string): Promise<UserContact[]> {
  const contacts = await getUserContacts(userId);
  return contacts.map(toContact);
}

export async function requestContactVerification(
  userId: string,
  contactId: string,
): Promise<{ token: string; expiresAt: string }> {
  const contact = await getContactById(contactId);
  if (!contact || contact.user_id !== userId) {
    throw new HttpError(404, "USER_CONTACT_NOT_FOUND", "USER_CONTACT_NOT_FOUND");
  }
  if (contact.is_verified) {
    throw new HttpError(409, "USER_CONTACT_ALREADY_VERIFIED", "USER_CONTACT_ALREADY_VERIFIED");
  }

  const now = Date.now();
  const tokenType = contactTokenType(contactId);
  const windowStart = new Date(
    now - AUTH_SECURITY_POLICY.contactVerification.resendWindowMinutes * MILLISECONDS_PER_MINUTE,
  );
  const recentAttempts = await countAuthTokensSince(userId, tokenType, windowStart);
  if (recentAttempts >= AUTH_SECURITY_POLICY.contactVerification.resendLimit) {
    throw new HttpError(
      429,
      "USER_CONTACT_VERIFY_LIMIT",
      "Verification request limit reached. Try again later.",
    );
  }

  const retentionCutoff = new Date(
    now - AUTH_SECURITY_POLICY.contactVerification.tokenRetentionDays * MILLISECONDS_PER_DAY,
  );
  await purgeAuthTokensOlderThan(tokenType, retentionCutoff);
  await markAuthTokensConsumed(userId, tokenType);

  const { raw, hash } = generateContactToken();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + contactVerificationTtlMilliseconds()).toISOString();

  await createAuthToken({
    id: crypto.randomUUID(),
    user_id: userId,
    token_type: tokenType,
    token_hash: hash,
    created_at: createdAt,
    expires_at: expiresAt,
  });

  await insertAudit({
    actorUserId: userId,
    entityType: "user_contacts",
    action: "verification_token_requested",
    entityId: contactId,
    metadata: { type: contact.type },
  });

  return { token: raw, expiresAt };
}

export async function updatePrimaryEmail(userId: string, email: string): Promise<UserDetail> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    throw new HttpError(422, "USER_EMAIL_INVALID", "USER_EMAIL_INVALID");
  }
  if (await isEmailBlacklisted(trimmed)) {
    throw new HttpError(403, "USER_EMAIL_BLOCKED", "USER_EMAIL_BLOCKED");
  }

  try {
    await upsertContact(userId, {
      type: "email",
      value: trimmed,
      isPrimary: true,
      isRecovery: true,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "USER_EMAIL_TAKEN", "USER_EMAIL_TAKEN");
    }
    throw error;
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "user_contacts",
    action: "email_upsert",
    entityId: userId,
    metadata: { email: trimmed },
  });

  const refreshed = await fetchUserWithContacts(userId);
  if (!refreshed) {
    throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
  }
  return toUserDetail(refreshed.user, refreshed.contacts, refreshed.avatar);
}

export async function updatePhoneNumber(
  userId: string,
  phone: string,
  isRecovery = true,
): Promise<UserDetail> {
  const trimmed = phone.trim();
  if (!trimmed) {
    throw new HttpError(422, "USER_PHONE_INVALID", "USER_PHONE_INVALID");
  }

  try {
    await upsertContact(userId, {
      type: "phone",
      value: trimmed,
      isPrimary: false,
      isRecovery,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "USER_PHONE_TAKEN", "USER_PHONE_TAKEN");
    }
    throw error;
  }

  await insertAudit({
    actorUserId: userId,
    entityType: "user_contacts",
    action: "phone_upsert",
    entityId: userId,
    metadata: { phone: trimmed, isRecovery },
  });

  const refreshed = await fetchUserWithContacts(userId);
  if (!refreshed) {
    throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
  }
  return toUserDetail(refreshed.user, refreshed.contacts, refreshed.avatar);
}

export async function verifyContact(
  userId: string,
  contactId: string,
  token: string,
): Promise<UserContact> {
  const contact = await getContactById(contactId);
  if (!contact || contact.user_id !== userId) {
    throw new HttpError(404, "USER_CONTACT_NOT_FOUND", "USER_CONTACT_NOT_FOUND");
  }

  if (contact.is_verified) {
    return toContact(contact);
  }

  const trimmedToken = token?.trim();
  if (!trimmedToken) {
    throw new HttpError(400, "USER_CONTACT_TOKEN_REQUIRED", "USER_CONTACT_TOKEN_REQUIRED");
  }

  const tokenType = contactTokenType(contactId);
  const tokenHash = crypto.createHash("sha256").update(trimmedToken).digest("hex");
  const record = await findAuthToken(tokenType, tokenHash);
  if (!record || record.user_id !== userId) {
    throw new HttpError(400, "USER_CONTACT_TOKEN_INVALID", "USER_CONTACT_TOKEN_INVALID");
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await consumeAuthToken(record.id);
    throw new HttpError(400, "USER_CONTACT_TOKEN_EXPIRED", "USER_CONTACT_TOKEN_EXPIRED");
  }

  await markContactVerified(contactId);
  await consumeAuthToken(record.id);
  await markAuthTokensConsumed(userId, tokenType);

  await insertAudit({
    actorUserId: userId,
    entityType: "user_contacts",
    action: "contact_verify",
    entityId: contactId,
    metadata: { type: contact.type },
  });

  const refreshed = await getContactById(contactId);
  if (!refreshed) {
    throw new HttpError(500, "USER_CONTACT_REFRESH_FAILED", "USER_CONTACT_REFRESH_FAILED");
  }
  return toContact(refreshed);
}

export async function removeContact(userId: string, contactId: string): Promise<void> {
  const contact = await getContactById(contactId);
  if (!contact || contact.user_id !== userId) {
    throw new HttpError(404, "USER_CONTACT_NOT_FOUND", "USER_CONTACT_NOT_FOUND");
  }
  if (contact.type === "email" && contact.is_primary) {
    throw new HttpError(400, "USER_CONTACT_REMOVE_PRIMARY", "USER_CONTACT_REMOVE_PRIMARY");
  }
  await deleteContact(userId, contactId);
  await insertAudit({
    actorUserId: userId,
    entityType: "user_contacts",
    action: "contact_remove",
    entityId: contactId,
    metadata: { type: contact.type },
  });
}
