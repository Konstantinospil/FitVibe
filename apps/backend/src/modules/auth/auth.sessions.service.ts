import { HttpError } from "../../utils/http.js";
import {
  findSessionById,
  listSessionsByUserId,
  revokeRefreshBySession,
  revokeRefreshByUserExceptSession,
  revokeRefreshByUserId,
  revokeSessionById,
  revokeSessionsByUserId,
} from "./auth.repository.js";
import type { SessionRecord, SessionRevokeOptions, SessionView } from "./auth.types.js";
import { recordAuthAuditEvent, sanitizeAuthUserAgent } from "./auth.audit.js";

export async function listSessions(
  userId: string,
  currentSessionId: string | null = null,
): Promise<SessionView[]> {
  const sessions = (await listSessionsByUserId(userId)) as SessionRecord[];
  return sessions.map((session) => ({
    id: session.jti,
    userAgent: session.user_agent,
    ip: session.ip,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
    revokedAt: session.revoked_at,
    isCurrent: currentSessionId ? session.jti === currentSessionId : false,
  }));
}

export async function revokeSessions(
  userId: string,
  options: SessionRevokeOptions,
): Promise<{ revoked: number }> {
  const { sessionId, revokeAll, revokeOthers, currentSessionId = null, context = {} } = options;
  const now = new Date().toISOString();
  let revokedCount = 0;

  if (!sessionId && !revokeAll && !revokeOthers) {
    throw new HttpError(400, "AUTH_INVALID_SCOPE", "AUTH_INVALID_SCOPE");
  }

  if (sessionId) {
    const session = await findSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new HttpError(404, "AUTH_SESSION_NOT_FOUND", "AUTH_SESSION_NOT_FOUND");
    }
    if (!session.revoked_at) {
      await revokeSessionById(sessionId);
      await revokeRefreshBySession(sessionId);
      revokedCount = 1;
    }
    await recordAuthAuditEvent(userId, "auth.session_revoke_single", {
      sessionId,
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: sanitizeAuthUserAgent(context.userAgent),
      at: now,
    });
    return { revoked: revokedCount };
  }

  const sessions = (await listSessionsByUserId(userId)) as SessionRecord[];
  if (revokeAll) {
    const targets = sessions.filter((session) => !session.revoked_at);
    if (targets.length) {
      await revokeSessionsByUserId(userId);
      await revokeRefreshByUserId(userId);
    }
    revokedCount = targets.length;
    await recordAuthAuditEvent(userId, "auth.session_revoke_all", {
      revoked: revokedCount,
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: sanitizeAuthUserAgent(context.userAgent),
      at: now,
    });
    return { revoked: revokedCount };
  }

  if (revokeOthers) {
    if (!currentSessionId) {
      throw new HttpError(400, "AUTH_INVALID_SCOPE", "Current session id required");
    }
    const targets = sessions.filter(
      (session) => !session.revoked_at && session.jti !== currentSessionId,
    );
    if (targets.length) {
      await revokeSessionsByUserId(userId, currentSessionId);
      await revokeRefreshByUserExceptSession(userId, currentSessionId);
    }
    revokedCount = targets.length;
    await recordAuthAuditEvent(userId, "auth.session_revoke_others", {
      revoked: revokedCount,
      keepSessionId: currentSessionId,
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: sanitizeAuthUserAgent(context.userAgent),
      at: now,
    });
    return { revoked: revokedCount };
  }

  return { revoked: revokedCount };
}
