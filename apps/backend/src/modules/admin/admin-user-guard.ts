import { HttpError } from "../../utils/http.js";

/**
 * Generic administrator actions must not change privileged accounts.
 * Privileged role management is handled by the dedicated superadmin workflow.
 */
export function assertAdminTargetManageable(
  actorUserId: string | null,
  targetUserId: string,
  targetRoleCode: string,
): void {
  if (actorUserId === targetUserId) {
    throw new HttpError(
      400,
      "CANNOT_MODIFY_SELF",
      "Cannot perform this action on your own account",
    );
  }

  if (targetRoleCode === "admin" || targetRoleCode === "superadmin") {
    throw new HttpError(403, "CANNOT_MODIFY_ADMIN", "Cannot modify another administrator account");
  }
}
