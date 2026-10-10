import type { UserStatus } from "../users/users.types.js";

export interface JwtPayload {
  sub: string;
  role: string;
  sid: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  iat?: number;
  exp?: number;
  jti?: string;
  typ?: "refresh";
}

export interface RegisterProfileInput {
  display_name?: string;
  sex?: string;
  weight_kg?: number | null;
  fitness_level?: string | null;
  date_of_birth?: string | null;
  /** @deprecated Send date_of_birth instead. */
  age?: number | null;
}

export interface RegisterDTO {
  email: string;
  alias?: string;
  username?: string;
  password: string;
  profile?: RegisterProfileInput;
  terms_accepted: boolean;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
}

export interface UserSafe {
  id: string;
  email: string;
  username: string;
  role: string;
  status: UserStatus;
  created_at: string;
}

export interface LoginContext {
  userAgent?: string | null;
  ip?: string | null;
  requestId?: string | null;
}

export interface SessionRecord {
  jti: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent: boolean;
}

export interface RevokeSessionsInput {
  sessionId?: string | null;
  revokeAll?: boolean;
  revokeOthers?: boolean;
}

export interface SessionRevokeOptions extends RevokeSessionsInput {
  currentSessionId?: string | null;
  context?: LoginContext;
}
