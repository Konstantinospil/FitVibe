import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  countAuthTokensSince,
  createAuthToken,
  markAuthTokensConsumed,
  purgeAuthTokensOlderThan,
} from "./auth.repository.js";
import { HttpError } from "../../utils/http.js";

const TOKEN_RETENTION_DAYS = 7;
const RESEND_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_LIMIT = 3;

export const TOKEN_TYPES = {
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
} as const;

function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export async function issueAuthToken(userId: string, type: string, ttlSeconds: number) {
  const now = Date.now();
  const retentionCutoff = new Date(now - TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await purgeAuthTokensOlderThan(type, retentionCutoff);

  if (type === TOKEN_TYPES.EMAIL_VERIFICATION) {
    const windowStart = new Date(now - RESEND_WINDOW_MS);
    const recentAttempts = await countAuthTokensSince(userId, type, windowStart);
    if (recentAttempts >= EMAIL_VERIFICATION_RESEND_LIMIT) {
      throw new HttpError(429, "AUTH_TOO_MANY_REQUESTS", "AUTH_TOO_MANY_REQUESTS");
    }
  }

  await markAuthTokensConsumed(userId, type);
  const { raw, hash } = generateToken();
  const issuedAtIso = new Date(now).toISOString();
  const expires_at = new Date(now + ttlSeconds * 1000).toISOString();
  await createAuthToken({
    id: uuidv4(),
    user_id: userId,
    token_type: type,
    token_hash: hash,
    expires_at,
    created_at: issuedAtIso,
  });
  return raw;
}
