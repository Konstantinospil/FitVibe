import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { assertTermsRequirementSatisfied } from "./auth.legal-gate.js";
import { HttpError } from "../../utils/http.js";
import { attachAnonymousConsents } from "../consent/consent.repository.js";
import { verify2FACode } from "./two-factor.service.js";
import { normalizeAuthTiming } from "./timing.utils.js";
import {
  claimPending2FASessionVerified,
  deletePending2FASession,
  getPending2FASession,
  incrementPending2FAFailures,
} from "./pending-2fa.repository.js";
import { createSessionWithRefresh, findUserById } from "./auth.repository.js";
import type { LoginContext, TokenPair, UserSafe } from "./auth.types.js";
import {
  recordAuthAuditEvent as recordAuditEvent,
  sanitizeAuthUserAgent as sanitizeUserAgent,
} from "./auth.audit.js";
import { toSafeUser } from "./auth.mapping.js";
import { resetLoginFailures } from "./auth.login-attempt.service.js";
import {
  accessTokenTtl,
  nextSessionExpiry,
  signAccess,
  signRefresh,
} from "./auth.session-tokens.js";

const DUMMY_SECOND_FACTOR_HASH = bcrypt.hashSync("FITV-0000", 12);
const MAX_SECOND_FACTOR_ATTEMPTS = 3;

function invalidVerification(): HttpError {
  return new HttpError(401, "AUTH_VERIFICATION_FAILED", "AUTH_VERIFICATION_FAILED");
}

async function performDecoySecondFactorWork(code: string): Promise<void> {
  const comparisons = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i.test(code) ? 10 : 1;
  for (let i = 0; i < comparisons; i += 1) {
    await bcrypt.compare(code, DUMMY_SECOND_FACTOR_HASH);
  }
}

function isValidUUID(value: string | null): boolean {
  return Boolean(
    value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

export async function verify2FALogin(
  pendingSessionId: string,
  code: string,
  context: LoginContext = {},
): Promise<{
  user: UserSafe;
  tokens: TokenPair;
  session: { id: string; expiresAt: string };
}> {
  const startTime = Date.now();
  const ipAddress = context.ip ?? "unknown";
  const userAgent = sanitizeUserAgent(context.userAgent);

  try {
    const pendingSession = await getPending2FASession(pendingSessionId);
    if (!pendingSession) {
      await performDecoySecondFactorWork(code);
      throw invalidVerification();
    }

    const expiresAt = new Date(pendingSession.expires_at);
    if (
      pendingSession.verified ||
      (pendingSession.failed_attempts ?? 0) >= MAX_SECOND_FACTOR_ATTEMPTS ||
      new Date() > expiresAt
    ) {
      await performDecoySecondFactorWork(code);
      throw invalidVerification();
    }

    if (pendingSession.ip !== (context.ip ?? null)) {
      await recordAuditEvent(pendingSession.user_id, "auth.login_2fa_ip_mismatch", {
        pendingSessionId,
        expectedIp: pendingSession.ip,
        actualIp: context.ip ?? null,
        requestId: context.requestId ?? null,
      });
      await performDecoySecondFactorWork(code);
      throw invalidVerification();
    }

    const isValidCode = await verify2FACode(pendingSession.user_id, code);
    if (!isValidCode) {
      const updated = await incrementPending2FAFailures(pendingSessionId);
      const failedAttempts = updated?.failed_attempts ?? MAX_SECOND_FACTOR_ATTEMPTS;

      await recordAuditEvent(pendingSession.user_id, "auth.login_2fa_failed", {
        pendingSessionId,
        ip: ipAddress,
        failedAttempts,
        exhausted: failedAttempts >= MAX_SECOND_FACTOR_ATTEMPTS,
        requestId: context.requestId ?? null,
      });

      throw invalidVerification();
    }

    const claimed = await claimPending2FASessionVerified(pendingSessionId);
    if (!claimed) {
      throw invalidVerification();
    }

    const user = await findUserById(pendingSession.user_id);
    if (!user || user.status !== "active") {
      throw invalidVerification();
    }

    await assertTermsRequirementSatisfied(user.id);

    await resetLoginFailures(
      pendingSession.identifier ?? user.primary_email ?? user.username,
      ipAddress,
    );

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

    await recordAuditEvent(user.id, "auth.login_2fa_success", {
      sessionId,
      pendingSessionId,
      userAgent,
      ip: context.ip ?? null,
      requestId: context.requestId ?? null,
    });
    if (isValidUUID(user.id)) {
      await attachAnonymousConsents(user.id, context.ip ?? ipAddress);
    }

    await deletePending2FASession(pendingSessionId);

    return {
      user: toSafeUser(user),
      tokens,
      session: { id: sessionId, expiresAt: sessionExpiresAt },
    };
  } finally {
    await normalizeAuthTiming(startTime);
  }
}
