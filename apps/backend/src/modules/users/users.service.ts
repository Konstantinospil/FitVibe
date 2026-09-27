import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../../db/connection.js";
import {
  findUserById,
  listUsers as listUserRows,
  createUserRecord,
  setUserStatus,
  fetchUserWithContacts,
  insertStateHistory,
  getUserContacts,
  upsertContact,
  updateProfileAlias,
} from "./users.repository.js";
import type {
  ChangePasswordDTO,
  CreateUserDTO,
  UserSafe,
  UserDetail,
  UserStatus,
} from "./users.types.js";
import {
  changePasswordAndRevokeAuthAtomic,
  revokeUserAuthStateAtomic,
} from "../auth/auth.repository.js";
import { assertPasswordPolicy } from "../auth/passwordPolicy.js";
import { HttpError } from "../../utils/http.js";
import { insertAudit } from "../common/audit.util.js";
import { primaryEmail, toUserDetail, toUserSafe } from "./users.mapping.js";
import { ensureUsernameAvailable, ensureUsernameFormat } from "./users.username.js";
import { isEmailBlacklisted } from "../common/email-blacklist.repository.js";
import {
  scheduleAccountDeletion,
  executeAccountDeletion,
  processDueAccountDeletions,
  type DeleteSchedule,
} from "./dsr.service.js";

const STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  pending_verification: ["active", "suspended", "banned", "pending_deletion"],
  active: ["suspended", "banned", "pending_deletion"],
  suspended: ["active", "banned", "pending_deletion"],
  banned: ["active", "suspended", "pending_deletion"],
  pending_deletion: [],
  deleted: [],
};
const INITIAL_ALLOWED_STATUSES: UserStatus[] = ["pending_verification", "active", "suspended"];

export { executeAccountDeletion, processDueAccountDeletions };

function assertStatusTransition(current: string, next: UserStatus) {
  const allowed = STATUS_TRANSITIONS[current as UserStatus] ?? [];
  if (!allowed.includes(next)) {
    throw new HttpError(
      400,
      "USER_STATUS_INVALID",
      `Cannot transition status from ${current} to ${next}`,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === "string" && maybeCode === "23505";
}

export async function createUser(
  actorUserId: string | null,
  dto: CreateUserDTO,
): Promise<UserDetail> {
  const userId = crypto.randomUUID();
  const username = dto.username.trim();
  const displayName = dto.displayName.trim();
  const email = dto.email.trim().toLowerCase();
  const roleCode = dto.role.trim();
  const initialStatus: UserStatus = dto.status ?? "pending_verification";

  ensureUsernameFormat(username);
  if (!displayName) {
    throw new HttpError(422, "USER_DISPLAY_NAME_REQUIRED", "USER_DISPLAY_NAME_REQUIRED");
  }
  if (!email) {
    throw new HttpError(422, "USER_EMAIL_INVALID", "USER_EMAIL_INVALID");
  }
  if (await isEmailBlacklisted(email)) {
    throw new HttpError(403, "USER_EMAIL_BLOCKED", "USER_EMAIL_BLOCKED");
  }
  if (!roleCode) {
    throw new HttpError(422, "USER_ROLE_INVALID", "USER_ROLE_INVALID");
  }
  if (!INITIAL_ALLOWED_STATUSES.includes(initialStatus)) {
    throw new HttpError(400, "USER_STATUS_INVALID", "Invalid initial status");
  }

  await ensureUsernameAvailable(userId, username);
  assertPasswordPolicy(dto.password, { email, username });
  const passwordHash = await bcrypt.hash(dto.password, 12);
  const locale = dto.locale?.trim() || undefined;
  const preferredLang = dto.preferredLang;

  try {
    await db.transaction(async (trx) => {
      await createUserRecord(
        {
          id: userId,
          displayName,
          locale,
          preferredLang,
          status: initialStatus,
          roleCode,
          passwordHash,
        },
        trx,
      );
      await updateProfileAlias(userId, username, trx);
      try {
        await upsertContact(
          userId,
          { type: "email", value: email, isPrimary: true, isRecovery: true },
          trx,
        );
      } catch (contactError) {
        if (isUniqueViolation(contactError)) {
          throw new HttpError(409, "USER_EMAIL_TAKEN", "USER_EMAIL_TAKEN");
        }
        throw contactError;
      }
      await insertStateHistory(userId, "status", null, initialStatus, trx);
    });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "USER_USERNAME_TAKEN", "USER_USERNAME_TAKEN");
    }
    throw error;
  }

  await insertAudit({
    actorUserId,
    entityType: "users",
    action: "create",
    entityId: userId,
    metadata: {
      status: initialStatus,
      role: roleCode,
    },
  });

  const created = await fetchUserWithContacts(userId);
  if (!created) {
    throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
  }
  return await toUserDetail(created.user, created.contacts, created.avatar);
}

export async function getMe(id: string): Promise<UserDetail | null> {
  const full = await fetchUserWithContacts(id);
  if (!full) {
    return null;
  }
  return await toUserDetail(full.user, full.contacts, full.avatar);
}

export async function listAll(limit = 50, offset = 0): Promise<UserSafe[]> {
  const rows = await listUserRows(limit, offset);
  return rows.map(toUserSafe);
}

export { updateProfile } from "./users.profile.service.js";

export async function updatePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }

  const ok = await bcrypt.compare(dto.currentPassword, user.password_hash);
  if (!ok) {
    throw new HttpError(401, "USER_INVALID_PASSWORD", "USER_INVALID_PASSWORD");
  }

  const contacts = await getUserContacts(userId);
  const email = primaryEmail(contacts) ?? undefined;

  assertPasswordPolicy(dto.newPassword, { email, username: user.username });
  const newHash = await bcrypt.hash(dto.newPassword, 12);
  await changePasswordAndRevokeAuthAtomic(userId, newHash);
  await insertAudit({
    actorUserId: userId,
    entityType: "users",
    action: "password_change",
    entityId: userId,
    metadata: { rotatedSessions: true, accessInvalidated: true },
  });
}

export async function changeStatus(
  actorUserId: string | null,
  userId: string,
  nextStatus: UserStatus,
): Promise<UserDetail> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }
  if (user.status === nextStatus) {
    const full = await fetchUserWithContacts(userId);
    if (!full) {
      throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
    }
    return await toUserDetail(full.user, full.contacts, full.avatar);
  }
  assertStatusTransition(user.status, nextStatus);

  await db.transaction(async (trx) => {
    await setUserStatus(userId, nextStatus, trx);
    await insertStateHistory(userId, "status", user.status, nextStatus, trx);
    if (nextStatus !== "active") {
      await revokeUserAuthStateAtomic(userId, trx);
    }
  });

  await insertAudit({
    actorUserId,
    entityType: "users",
    action: "status_change",
    entityId: userId,
    metadata: {
      from: user.status,
      to: nextStatus,
      accessInvalidated: nextStatus !== "active",
    },
  });

  const refreshed = await fetchUserWithContacts(userId);
  if (!refreshed) {
    throw new HttpError(500, "USER_REFRESH_FAILED", "USER_REFRESH_FAILED");
  }
  return toUserDetail(refreshed.user, refreshed.contacts, refreshed.avatar);
}

export async function requestAccountDeletion(
  userId: string,
  password: string,
): Promise<DeleteSchedule> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HttpError(404, "USER_NOT_FOUND", "USER_NOT_FOUND");
  }

  // SECURITY: Verify password before allowing account deletion
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw new HttpError(401, "USER_INVALID_PASSWORD", "Invalid password");
  }

  if (user.status !== "pending_deletion") {
    await changeStatus(userId, userId, "pending_deletion");
    await insertAudit({
      actorUserId: userId,
      entityType: "users",
      action: "delete_request",
      entityId: userId,
      metadata: {},
    });
  }

  const schedule = await scheduleAccountDeletion(userId);
  return schedule;
}

export {
  listContacts,
  requestContactVerification,
  updatePrimaryEmail,
  updatePhoneNumber,
  verifyContact,
  removeContact,
} from "./users.contacts.service.js";
export { collectUserData } from "./users.export.service.js";
export { getPrivacySettings, updatePrivacySettings } from "./users.privacy.service.js";
export { getUserPreferences, updateUserPreferences } from "./users.preferences.service.js";
