import { insertAudit } from "../common/audit.util.js";
import {
  incrementAuthBlockedLogin,
  incrementAuthLoginSuccess,
  incrementAuthMfaEvent,
} from "../../observability/metrics.js";

export function sanitizeAuthUserAgent(userAgent?: string | null): string | null {
  if (!userAgent) {
    return null;
  }
  return userAgent.length > 512 ? userAgent.slice(0, 512) : userAgent;
}

export async function recordAuthAuditEvent(
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await insertAudit({
    actorUserId: userId,
    entityType: "auth",
    action,
    metadata,
  });

  // Do not include identities or metadata in metric labels. Only count events
  // once the audit write/outbox path has accepted the event.
  switch (action) {
    case "auth.login":
      incrementAuthLoginSuccess("password");
      break;
    case "auth.login_2fa_success":
      incrementAuthLoginSuccess("mfa");
      incrementAuthMfaEvent("login_success");
      break;
    case "auth.login_2fa_failed":
      incrementAuthMfaEvent("login_failed");
      break;
    case "auth.login_2fa_throttled":
      incrementAuthMfaEvent("blocked");
      break;
    case "auth.login_blocked":
      incrementAuthBlockedLogin("account");
      break;
    case "auth.login_blocked_ip":
      incrementAuthBlockedLogin("ip");
      break;
  }
}
