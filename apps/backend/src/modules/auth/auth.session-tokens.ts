import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env, RSA_KEYS } from "../../config/env.js";
import type { JwtPayload, RefreshTokenPayload } from "./auth.types.js";
import { ADMIN_SESSION_MAX_AGE_MS, isPrivilegedRole } from "./privileged-session.policy.js";

const ACCESS_TTL = env.ACCESS_TOKEN_TTL;
// #557: privileged JWTs are capped at five minutes, and strictly shorter
// than member JWTs for all supported ACCESS_TOKEN_TTL_SEC values (>= 2).
const ADMIN_ACCESS_TTL = Math.max(1, Math.min(5 * 60, Math.floor(ACCESS_TTL / 2)));
const REFRESH_TTL = env.REFRESH_TOKEN_TTL;
const SESSION_EXPIRY_MS = REFRESH_TTL * 1000;

export function refreshTokenTtlForRole(role: string): number {
  return isPrivilegedRole(role)
    ? Math.min(REFRESH_TTL, ADMIN_SESSION_MAX_AGE_MS / 1000)
    : REFRESH_TTL;
}

export function nextSessionExpiry(role = "athlete", createdAt = Date.now()): string {
  return new Date(Math.min(
    Date.now() + SESSION_EXPIRY_MS,
    isPrivilegedRole(role) ? createdAt + ADMIN_SESSION_MAX_AGE_MS : Number.POSITIVE_INFINITY,
  )).toISOString();
}

export function accessTokenTtlForRole(role: string): number {
  return role === "admin" || role === "superadmin" ? ADMIN_ACCESS_TTL : ACCESS_TTL;
}

export function signAccess(payload: Omit<JwtPayload, "iat" | "exp" | "jti">): string {
  return jwt.sign(payload, RSA_KEYS.privateKey, {
    algorithm: "RS256",
    expiresIn: accessTokenTtlForRole(payload.role),
    jwtid: uuidv4(),
  });
}

export function signRefresh(payload: Pick<RefreshTokenPayload, "sub" | "sid" | "mfa"> & { role?: string }): string {
  return jwt.sign(
    { sub: payload.sub, sid: payload.sid, mfa: payload.mfa === true, typ: "refresh" },
    RSA_KEYS.privateKey,
    {
      algorithm: "RS256",
      expiresIn: refreshTokenTtlForRole(payload.role ?? "athlete"),
      jwtid: uuidv4(),
    },
  );
}

export function verifyAccess(token: string): JwtPayload {
  const decoded = jwt.verify(token, RSA_KEYS.publicKey, { algorithms: ["RS256"] });
  if (typeof decoded === "string") {
    return JSON.parse(decoded) as JwtPayload;
  }
  return decoded as JwtPayload;
}

export function verifyRefresh(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, RSA_KEYS.publicKey, { algorithms: ["RS256"] });
  if (typeof decoded === "string") {
    return JSON.parse(decoded) as RefreshTokenPayload;
  }
  return decoded as RefreshTokenPayload;
}

export const accessTokenTtl = ACCESS_TTL;
