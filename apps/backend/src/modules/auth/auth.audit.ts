import { insertAudit } from "../common/audit.util.js";

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
}
