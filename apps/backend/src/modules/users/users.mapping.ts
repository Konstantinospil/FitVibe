import type { AvatarRow, ContactRow, UserRow } from "./users.repository.js";
import { getLatestUserMetrics, getProfileByUserId } from "./users.repository.js";
import type { UserAvatar, UserContact, UserDetail, UserSafe, UserStatus } from "./users.types.js";

export function toContact(row: ContactRow): UserContact {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    isPrimary: row.is_primary,
    isRecovery: row.is_recovery,
    isVerified: row.is_verified,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

export function primaryEmail(contacts: ContactRow[]): string | null {
  return contacts.find((contact) => contact.type === "email" && contact.is_primary)?.value ?? null;
}

function primaryPhone(contacts: ContactRow[]): string | null {
  return contacts.find((contact) => contact.type === "phone")?.value ?? null;
}

function toUserAvatar(row: AvatarRow | null | undefined): UserAvatar | null {
  if (!row) {
    return null;
  }
  return {
    url: row.file_url,
    mimeType: row.mime_type ?? null,
    bytes: row.bytes ?? null,
    updatedAt: row.created_at ?? null,
  };
}

function toUserAvatarFromList(row: {
  avatar_url?: string | null;
  avatar_mime_type?: string | null;
  avatar_bytes?: number | string | null;
  avatar_updated_at?: string | null;
}): UserAvatar | null {
  if (!row?.avatar_url) {
    return null;
  }
  const bytes =
    row.avatar_bytes === undefined || row.avatar_bytes === null ? null : Number(row.avatar_bytes);
  return {
    url: row.avatar_url,
    mimeType: row.avatar_mime_type ?? null,
    bytes,
    updatedAt: row.avatar_updated_at ?? null,
  };
}

export async function toUserDetail(
  user: UserRow,
  contacts: ContactRow[],
  avatar?: AvatarRow | null,
): Promise<UserDetail> {
  const profile = await getProfileByUserId(user.id);
  const latestMetrics = await getLatestUserMetrics(user.id);

  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    locale: user.locale,
    preferredLang: user.preferred_lang,
    defaultVisibility: user.default_visibility ?? "private",
    units: user.units ?? "metric",
    role: user.role_code,
    status: user.status as UserStatus,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    primaryEmail: primaryEmail(contacts),
    phoneNumber: primaryPhone(contacts),
    avatar: toUserAvatar(avatar),
    contacts: contacts.map(toContact),
    profile: {
      alias: profile?.alias ?? null,
      bio: profile?.bio ?? null,
      weight: latestMetrics?.weight ?? null,
      weightUnit: latestMetrics?.unit ?? null,
      fitnessLevel: latestMetrics?.fitness_level_code ?? null,
      trainingFrequency: latestMetrics?.training_frequency ?? null,
    },
  };
}

export function toUserSafe(row: UserRow): UserSafe {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    locale: row.locale,
    preferredLang: row.preferred_lang,
    defaultVisibility: row.default_visibility ?? "private",
    units: row.units ?? "metric",
    role: row.role_code,
    status: row.status as UserStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    primaryEmail: row.primary_email ?? null,
    phoneNumber: null,
    avatar: toUserAvatarFromList(row),
  };
}
