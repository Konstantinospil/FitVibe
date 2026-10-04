import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { RSA_KEYS } from "../../config/env.js";
import { incrementRefreshReuse } from "../../observability/metrics.js";
import { HttpError } from "../../utils/http.js";
import { assertTermsRequirementSatisfied } from "./auth.legal-gate.js";
import {
  findRefreshTokenRaw,
  findSessionById,
  findUserById,
  getRefreshByHash,
  revokeRefreshByHash,
  revokeSessionFamilyAtomic,
  rotateRefreshAtomic,
} from "./auth.repository.js";
import type { LoginContext, RefreshTokenPayload, UserSafe } from "./auth.types.js";
import {
  recordAuthAuditEvent as recordAuditEvent,
  sanitizeAuthUserAgent as sanitizeUserAgent,
} from "./auth.audit.js";
import { toSafeUser } from "./auth.mapping.js";
import { nextSessionExpiry, signAccess, signRefresh } from "./auth.session-tokens.js";

async function recordReuse(
  userId: string | null,
  sessionId: string,
  context: LoginContext,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  incrementRefreshReuse();
  await recordAuditEvent(userId, "auth.refresh_reuse", {
    sessionId,
    requestId: context.requestId ?? null,
    ip: context.ip ?? null,
    userAgent: sanitizeUserAgent(context.userAgent),
    outcome: "failure",
    familyRevoked: true,
    ...metadata,
  });
}

export async function refresh(
  refreshToken: string,
  context: LoginContext = {},
): Promise<{ user: UserSafe; newRefresh: string; accessToken: string }> {
  try {
    const decoded = jwt.verify(refreshToken, RSA_KEYS.publicKey, {
      algorithms: ["RS256"],
    }) as RefreshTokenPayload;
    if (!decoded?.sid) {
      throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
    }

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const record = await getRefreshByHash(tokenHash);
    if (!record) {
      try {
        const historical = await findRefreshTokenRaw(tokenHash);
        if (historical?.session_jti) {
          await revokeSessionFamilyAtomic(historical.session_jti);
          await recordReuse(historical.user_id ?? null, historical.session_jti, context);
        }
      } catch (error: unknown) {
        if (error instanceof HttpError) {
          throw error;
        }
      }
      throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
    }

    if (record.session_jti !== decoded.sid) {
      await revokeRefreshByHash(tokenHash);
      await recordAuditEvent(record.user_id, "auth.refresh_session_mismatch", {
        tokenId: record.id,
        sessionId: decoded.sid,
        storedSessionId: record.session_jti,
        requestId: context.requestId ?? null,
        outcome: "failure",
      });
      throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
    }

    const session = await findSessionById(decoded.sid);
    if (!session || session.user_id !== record.user_id) {
      await revokeRefreshByHash(tokenHash);
      throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
    }
    if (session.revoked_at) {
      await revokeRefreshByHash(tokenHash);
      throw new HttpError(401, "AUTH_SESSION_REVOKED", "AUTH_SESSION_REVOKED");
    }
    if (
      new Date(record.expires_at).getTime() <= Date.now() ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      await revokeSessionFamilyAtomic(session.jti);
      throw new HttpError(401, "AUTH_REFRESH_EXPIRED", "AUTH_REFRESH_EXPIRED");
    }

    const user = await findUserById(decoded.sub);
    if (!user || user.status !== "active") {
      await revokeSessionFamilyAtomic(session.jti);
      throw new HttpError(401, "AUTH_USER_NOT_FOUND", "User not found");
    }
    await assertTermsRequirementSatisfied(user.id);

    const newRefresh = signRefresh({ sub: user.id, sid: session.jti });
    const newHash = crypto.createHash("sha256").update(newRefresh).digest("hex");
    const newExpiry = nextSessionExpiry();
    const createdAt = new Date().toISOString();

    const patch: { expires_at: string; user_agent?: string | null; ip?: string | null } = {
      expires_at: newExpiry,
    };
    if (context.userAgent) {
      const sanitizedUserAgent = sanitizeUserAgent(context.userAgent);
      if (sanitizedUserAgent !== null && sanitizedUserAgent !== undefined) {
        patch.user_agent = sanitizedUserAgent;
      }
    }
    if (context.ip) {
      patch.ip = context.ip;
    }

    const rotated = await rotateRefreshAtomic(
      tokenHash,
      session.jti,
      {
        id: uuidv4(),
        user_id: user.id,
        token_hash: newHash,
        session_jti: session.jti,
        expires_at: newExpiry,
        created_at: createdAt,
      },
      patch,
    );

    if (!rotated) {
      await revokeSessionFamilyAtomic(session.jti);
      await recordReuse(user.id, session.jti, context, {
        previousTokenId: record.id,
        concurrentReplay: true,
      });
      throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
    }

    await recordAuditEvent(user.id, "auth.refresh", {
      sessionId: session.jti,
      previousTokenId: record.id,
      requestId: context.requestId ?? null,
      ip: context.ip ?? null,
      userAgent: sanitizeUserAgent(context.userAgent),
    });

    return {
      user: toSafeUser(user),
      newRefresh,
      accessToken: signAccess({
        sub: user.id,
        role: user.role_code,
        sid: session.jti,
      }),
    };
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "AUTH_INVALID_REFRESH", "AUTH_INVALID_REFRESH");
  }
}

export async function logout(
  refreshToken: string | undefined,
  context: LoginContext = {},
): Promise<void> {
  if (!refreshToken) {
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  let decoded: RefreshTokenPayload | null = null;
  try {
    decoded = jwt.verify(refreshToken, RSA_KEYS.publicKey, {
      algorithms: ["RS256"],
    }) as RefreshTokenPayload;
  } catch {
    decoded = null;
  }

  if (decoded?.sid) {
    await revokeSessionFamilyAtomic(decoded.sid);
  } else {
    await revokeRefreshByHash(tokenHash);
  }

  await recordAuditEvent(decoded?.sub ?? null, "auth.logout", {
    sessionId: decoded?.sid ?? null,
    requestId: context.requestId ?? null,
    ip: context.ip ?? null,
    userAgent: sanitizeUserAgent(context.userAgent),
    familyRevoked: Boolean(decoded?.sid),
    accessInvalidated: Boolean(decoded?.sid),
  });
}
