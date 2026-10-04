import type { AuthUserRecord } from "./auth.repository.js";
import type { UserSafe } from "./auth.types.js";

export function toSafeUser(record: AuthUserRecord): UserSafe {
  return {
    id: record.id,
    email: record.primary_email ?? "",
    username: record.username,
    role: record.role_code,
    status: record.status,
    created_at: record.created_at,
  };
}
