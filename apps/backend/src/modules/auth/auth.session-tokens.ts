import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env, RSA_KEYS } from "../../config/env.js";
import type { JwtPayload, RefreshTokenPayload } from "./auth.types.js";

const ACCESS_TTL = env.ACCESS_TOKEN_TTL;
const REFRESH_TTL = env.REFRESH_TOKEN_TTL;
const SESSION_EXPIRY_MS = REFRESH_TTL * 1000;

export function nextSessionExpiry(): string {
  return new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();
}

export function signAccess(payload: Omit<JwtPayload, "iat" | "exp" | "jti">): string {
  return jwt.sign(payload, RSA_KEYS.privateKey, {
    algorithm: "RS256",
    expiresIn: ACCESS_TTL,
    jwtid: uuidv4(),
  });
}

export function signRefresh(payload: Pick<RefreshTokenPayload, "sub" | "sid">): string {
  return jwt.sign({ sub: payload.sub, sid: payload.sid, typ: "refresh" }, RSA_KEYS.privateKey, {
    algorithm: "RS256",
    expiresIn: REFRESH_TTL,
    jwtid: uuidv4(),
  });
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
