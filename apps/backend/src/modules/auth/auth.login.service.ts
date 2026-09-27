import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { is2FAEnabled } from "./two-factor.service.js";
import { normalizeAuthTiming } from "./timing.utils.js";
import {
  createPending2FASession,
  hasRecentSecondFactorThrottle,
} from "./pending-2fa.repository.js";
import {
  createSessionWithRefresh,
  findUserByEmail,
  findUserByUsername,
} from "./auth.repository.js";
import { attachAnonymousConsents } from "../consent/consent.repository.js";
import type { LoginDTO, LoginContext, TokenPair, UserSafe } from "./auth.types.js";
import { assertTermsRequirementSatisfied } from "./auth.legal-gate.js";
import {
  recordAuthAuditEvent as recordAuditEvent,
  sanitizeAuthUserAgent as sanitizeUserAgent,
} from "./auth.audit.js";
import { toSafeUser } from "./auth.mapping.js";
import {
  assertLoginAllowed,
  recordLoginFailure,
  resetLoginFailures,
} from "./auth.login-attempt.service.js";
import {
  accessTokenTtl,
  nextSessionExpiry,
  signAccess,
  signRefresh,
} from "./auth.session-tokens.js";

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("fitvibe-placeholder-password", 12);
const PENDING_2FA_TTL_MS = 30 * 60 * 1000;
const SECOND_FACTOR_COOLDOWN_MS = 5 * 60 * 1000;

function isValidUUID(value: string | null): boolean {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

function buildOpaqueChallenge(): { requires2FA: true; pendingSessionId: string } {
  return {
    requires2FA: true,
    pendingSessionId: uuidv4(),
  };
}

function performDummySuccessfulPath(userId: string, role: string): void {
  const dummySessionId = uuidv4();
  const dummyRefresh = signRefresh({ sub: userId, sid: dummySessionId });
  crypto.createHash("sha256").update(dummyRefresh).digest("hex");
  signAccess({ sub: userId, role, sid: dummySessionId });
}

export async function login(
  dto: LoginDTO,
  context: LoginContext = {},
): Promise<
  | {
      requires2FA: false;
      user: UserSafe;
      tokens: TokenPair;
      session: { id: string; expiresAt: string };
    }
  | {
      requires2FA: true;
      pendingSessionId: string;
    }
> {
  const startTime = Date.now();
  const identifier = dto.email.trim().toLowerCase();
  const ipAddress = context.ip ?? "unknown";
  const userAgent = sanitizeUserAgent(context.userAgent);

  try {
    const loginAllowed = await assertLoginAllowed(identifier, ipAddress, context.requestId ?? null);
    if (!loginAllowed) {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      performDummySuccessfulPath(uuidv4(), "athlete");
      return buildOpaqueChallenge();
    }

    const user = identifier.includes("@")
      ? await findUserByEmail(identifier)
      : await findUserByUsername(identifier);

    if (!user || user.status !== "active") {
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      performDummySuccessfulPath(uuidv4(), "athlete");
      await recordLoginFailure({
        identifier,
        ipAddress,
        userAgent,
        actorUserId: null,
        requestId: context.requestId ?? null,
      });
      return buildOpaqueChallenge();
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      performDummySuccessfulPath(user.id, user.role_code);
      await recordLoginFailure({
        identifier,
        ipAddress,
        userAgent,
        actorUserId: user.id,
        requestId: context.requestId ?? null,
      });
      return buildOpaqueChallenge();
    }

    await recordAuditEvent(user.id, "auth.password_verified", {
      ip: ipAddress,
      requestId: context.requestId ?? null,
    });

    const has2FA = await is2FAEnabled(user.id);
    if (has2FA) {
      const throttled = await hasRecentSecondFactorThrottle(
        user.id,
        context.ip ?? null,
        new Date(Date.now() - SECOND_FACTOR_COOLDOWN_MS).toISOString(),
      );

      if (throttled) {
        await recordAuditEvent(user.id, "auth.login_2fa_throttled", {
          ip: ipAddress,
          requestId: context.requestId ?? null,
        });
        return buildOpaqueChallenge();
      }

      const pendingSessionId = uuidv4();
      const expiresAt = new Date(Date.now() + PENDING_2FA_TTL_MS);

      await createPending2FASession({
        id: pendingSessionId,
        user_id: user.id,
        identifier,
        expires_at: expiresAt.toISOString(),
        ip: context.ip ?? null,
        user_agent: userAgent,
      });

      await recordAuditEvent(user.id, "auth.login_2fa_required", {
        pendingSessionId,
        ip: ipAddress,
        requestId: context.requestId ?? null,
      });

      return {
        requires2FA: true,
        pendingSessionId,
      };
    }

    await assertTermsRequirementSatisfied(user.id);

    await resetLoginFailures(identifier, ipAddress);

    const sessionId = uuidv4();
    const issuedAtIso = new Date().toISOString();
    const sessionExpiresAt = nextSessionExpiry();

    const refreshToken = signRefresh({ sub: user.id, sid: sessionId });
    const token_hash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    await createSessionWithRefresh(
      {
        jti: sessionId,
        user_id: user.id,
        user_agent: userAgent,
        ip: context.ip ?? null,
        created_at: issuedAtIso,
        expires_at: sessionExpiresAt,
      },
      {
        id: uuidv4(),
        user_id: user.id,
        token_hash,
        session_jti: sessionId,
        expires_at: sessionExpiresAt,
        created_at: issuedAtIso,
      },
    );

    const tokens: TokenPair = {
      accessToken: signAccess({ sub: user.id, role: user.role_code, sid: sessionId }),
      refreshToken,
      accessExpiresIn: accessTokenTtl,
    };

    await recordAuditEvent(user.id, "auth.login", {
      sessionId,
      userAgent,
      ip: context.ip ?? null,
      requestId: context.requestId ?? null,
    });
    if (isValidUUID(user.id)) {
      await attachAnonymousConsents(user.id, ipAddress);
    }

    return {
      requires2FA: false,
      user: toSafeUser(user),
      tokens,
      session: { id: sessionId, expiresAt: sessionExpiresAt },
    };
  } finally {
    await normalizeAuthTiming(startTime);
  }
}
