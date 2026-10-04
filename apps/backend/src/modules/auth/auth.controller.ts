import type { NextFunction, Request, Response } from "express";
import {
  register as doRegister,
  login as doLogin,
  verify2FALogin as doVerify2FALogin,
  refresh as doRefresh,
  logout as doLogout,
  verifyEmail as doVerifyEmail,
  resendVerificationEmail as doResendVerificationEmail,
  requestPasswordReset,
  resetPassword as doResetPassword,
  listSessions as doListSessions,
  revokeSessions as doRevokeSessions,
  acceptTerms as doAcceptTerms,
  revokeTerms as doRevokeTerms,
  acceptPrivacyPolicy as doAcceptPrivacyPolicy,
  revokePrivacyPolicy as doRevokePrivacyPolicy,
  getLegalDocumentsStatus as doGetLegalDocumentsStatus,
  getLegalDocumentVersions as doGetLegalDocumentVersions,
} from "./auth.service.js";
import { env, JWKS } from "../../config/env.js";
import {
  RegisterSchema,
  LoginSchema,
  Verify2FALoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  RevokeSessionsSchema,
  AcceptTermsSchema,
  AcceptPrivacyPolicySchema,
  ResendVerificationSchema,
} from "./auth.schemas.js";
import type { z } from "zod";
import type { LoginContext } from "./auth.types.js";
import { HttpError } from "../../utils/http.js";
import { verifyAccess } from "./auth.session-tokens.js";
import { handleIdempotentRequest } from "../common/idempotency.helpers.js";
import { extractClientIp } from "../../utils/ip-extractor.js";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    maxAge: env.REFRESH_TOKEN_TTL * 1000,
  });
}

function setAccessCookie(res: Response, token: string) {
  res.cookie(env.ACCESS_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    maxAge: env.ACCESS_TOKEN_TTL * 1000,
  });
}

function clearAuthCookies(res: Response) {
  const options = {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.COOKIE_SECURE,
  };
  res.clearCookie(env.REFRESH_COOKIE_NAME, options);
  res.clearCookie(env.ACCESS_COOKIE_NAME, options);
}

function bearerToken(header?: string): string | null {
  if (!header || typeof header !== "string") {
    return null;
  }
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return value;
}

function currentSessionId(req: Request): string | null {
  const token =
    (req.cookies?.[env.ACCESS_COOKIE_NAME] as string | undefined) ??
    bearerToken(req.headers.authorization ?? undefined);
  if (!token) {
    return null;
  }
  try {
    const decoded = verifyAccess(token);
    return typeof decoded.sid === "string" ? decoded.sid : null;
  } catch {
    return null;
  }
}

function buildAuthContext(req: Request, res: Response): LoginContext {
  const clientIp = extractClientIp(req);
  return {
    userAgent: req.get("user-agent") ?? null,
    // PostgreSQL inet columns accept real IP addresses or NULL, never sentinel strings.
    ip: clientIp === "unknown" ? null : clientIp,
    requestId: req.requestId ?? res.locals.requestId ?? null,
  };
}

function getAuthenticatedUser(req: Request): { sub?: string; sid?: string; role?: string } | null {
  return req.user ?? null;
}

type RegisterInput = z.infer<typeof RegisterSchema>;
type LoginInput = z.infer<typeof LoginSchema>;
type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload: RegisterInput = RegisterSchema.parse(req.body);
    const scopeUserId = `anon:${payload.email}`;

    const execute = async (): Promise<Record<string, unknown>> => {
      const { verificationToken } = await doRegister(payload);
      const response: Record<string, unknown> = {
        message: "If the email is valid, a verification link will be sent shortly.",
      };
      if (!env.isProduction && verificationToken) {
        response.debugVerificationToken = verificationToken;
        response.verificationUrl = `${env.frontendUrl}/verify?token=${verificationToken}`;
      }
      return response;
    };

    const handled = await handleIdempotentRequest(req, res, scopeUserId, payload, async () => ({
      status: 202,
      body: await execute(),
    }));

    if (!handled) {
      res.status(202).json(await execute());
    }
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Prefer body token over query token for security (query params may be logged)
    const bodyToken =
      req.body && typeof req.body === "object" && "token" in req.body
        ? (req.body as Record<string, unknown>).token
        : undefined;
    const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
    // Only use query token if body token is not provided (backward compatibility)
    const token = typeof bodyToken === "string" ? bodyToken : queryToken;

    // SECURITY: Validate token before any use - reject invalid tokens immediately
    // This prevents user-controlled input from bypassing security checks
    if (!token || typeof token !== "string" || token.length === 0) {
      throw new HttpError(400, "AUTH_INVALID_TOKEN", "AUTH_INVALID_TOKEN");
    }
    // Validate token format (basic sanity check) - reject tokens that are too long
    // This prevents potential DoS or injection attacks
    if (token.length > 500) {
      throw new HttpError(400, "AUTH_INVALID_TOKEN", "Token format invalid");
    }
    // Additional validation: ensure token contains only expected characters
    // Verification tokens are typically base64url encoded UUIDs or similar
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      throw new HttpError(400, "AUTH_INVALID_TOKEN", "Token format invalid");
    }

    // Token is now validated - safe to use
    const user = await doVerifyEmail(token);
    res.json({ user });
    return;
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload: z.infer<typeof ResendVerificationSchema> = ResendVerificationSchema.parse(
      req.body,
    );
    await doResendVerificationEmail(payload.email);
    // Always return success to prevent user enumeration
    res.status(200).json({
      message:
        "If the email is registered and pending verification, a verification link will be sent shortly.",
    });
    return;
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const credentials: LoginInput = LoginSchema.parse(req.body);
    const context = buildAuthContext(req, res);
    const result = await doLogin(credentials, context);

    // Check if 2FA is required
    if (result.requires2FA) {
      res.json({
        requires2FA: true,
        pendingSessionId: result.pendingSessionId,
      });
      return;
    }

    // Normal login flow (no 2FA)
    // SECURITY: Tokens are ONLY set in HttpOnly cookies, never exposed to JavaScript
    setAccessCookie(res, result.tokens.accessToken);
    setRefreshCookie(res, result.tokens.refreshToken);

    // In non-production environments, also return tokens in JSON for testing/debugging
    const response: {
      requires2FA: false;
      user: typeof result.user;
      session: typeof result.session;
      tokens?: typeof result.tokens;
    } = {
      requires2FA: false,
      user: result.user,
      session: result.session,
    };

    if (!env.isProduction) {
      response.tokens = result.tokens;
    }

    res.json(response);
    return;
  } catch (error) {
    next(error);
  }
}

export async function verify2FALogin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = Verify2FALoginSchema.parse(req.body);
    const context = buildAuthContext(req, res);
    const { user, tokens, session } = await doVerify2FALogin(
      payload.pendingSessionId,
      payload.code,
      context,
    );

    // SECURITY: Tokens are ONLY set in HttpOnly cookies, never exposed to JavaScript
    setAccessCookie(res, tokens.accessToken);
    setRefreshCookie(res, tokens.refreshToken);

    // In non-production environments, also return tokens in JSON for testing/debugging
    const response: {
      user: typeof user;
      session: typeof session;
      tokens?: typeof tokens;
    } = {
      user,
      session,
    };

    if (!env.isProduction) {
      response.tokens = tokens;
    }

    res.json(response);
    return;
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;

    // SECURITY: Validate token before any use - reject invalid tokens immediately
    // This prevents user-controlled input from bypassing security checks
    if (!token || typeof token !== "string" || token.length === 0) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    // Validate token format (basic sanity check to prevent injection)
    // JWT tokens have a maximum practical length, reject excessively long tokens
    if (token.length > 1000) {
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid token format");
    }
    // Additional validation: ensure token contains only expected characters
    // JWT tokens are base64url encoded (A-Za-z0-9_-) with dots as separators
    if (!/^[A-Za-z0-9_.-]+$/.test(token)) {
      throw new HttpError(401, "UNAUTHENTICATED", "Invalid token format");
    }

    // Token is now validated - safe to use
    const context = buildAuthContext(req, res);
    const { user, newRefresh, accessToken } = await doRefresh(token, context);
    setRefreshCookie(res, newRefresh);
    setAccessCookie(res, accessToken);
    res.json({ user });
    return;
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
    const context = buildAuthContext(req, res);
    await doLogout(token, context);
    clearAuthCookies(res);
    res.status(204).send();
    return;
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload: ForgotPasswordInput = ForgotPasswordSchema.parse(req.body);
    const scopeUserId = `anon:${payload.email}`;

    const execute = async (): Promise<Record<string, unknown>> => {
      const { resetToken } = await requestPasswordReset(payload.email);
      const response: Record<string, unknown> = {
        message: "If the email is registered, a reset link will be sent shortly.",
      };
      if (!env.isProduction && resetToken) {
        response.debugResetToken = resetToken;
        response.resetUrl = `${env.appBaseUrl}/auth/password/reset?token=${resetToken}`;
      }
      return response;
    };

    const handled = await handleIdempotentRequest(req, res, scopeUserId, payload, async () => ({
      status: 202,
      body: await execute(),
    }));

    if (!handled) {
      res.status(202).json(await execute());
    }
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload: ResetPasswordInput = ResetPasswordSchema.parse(req.body);

    // SECURITY: Idempotency is NOT supported for password reset endpoints
    // because there is no safe way to scope the userId for unauthenticated requests.
    // Using user-controlled data (token) as userId scope would create a security vulnerability
    // where attackers could manipulate scoping to bypass checks or access cached responses.
    // Password resets are one-time operations where the risk of duplicate requests is minimal.

    await doResetPassword(payload.token, payload.newPassword);
    clearAuthCookies(res);
    res.status(204).send();
    return;
  } catch (error) {
    next(error);
  }
}

export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    const sessionId = authUser?.sid ?? currentSessionId(req);
    const sessions = await doListSessions(userId, sessionId ?? null);
    res.json({ sessions });
    return;
  } catch (error) {
    next(error);
  }
}

export async function revokeSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    const payload = RevokeSessionsSchema.parse(req.body ?? {});
    const sessionId = authUser?.sid ?? currentSessionId(req);
    if (payload.revokeOthers && !sessionId) {
      throw new HttpError(
        400,
        "AUTH_SESSION_UNKNOWN",
        "Current session is required to revoke others",
      );
    }
    const context = buildAuthContext(req, res);
    const result = await doRevokeSessions(userId, {
      sessionId: payload.sessionId ?? undefined,
      revokeAll: payload.revokeAll ?? false,
      revokeOthers: payload.revokeOthers ?? false,
      currentSessionId: sessionId,
      context,
    });

    // Check if we're revoking the current session
    // This happens when:
    // 1. revokeAll is true, OR
    // 2. A specific sessionId is provided and it matches the current session
    const isRevokingCurrentSession =
      payload.revokeAll === true ||
      (payload.sessionId !== undefined &&
        payload.sessionId !== null &&
        sessionId !== null &&
        String(payload.sessionId) === String(sessionId));

    if (isRevokingCurrentSession) {
      clearAuthCookies(res);
      res.status(204).send();
      return;
    }

    res.json({ revoked: result.revoked });
    return;
  } catch (error) {
    next(error);
  }
}

export async function acceptTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    AcceptTermsSchema.parse(req.body); // Validate payload
    await doAcceptTerms(userId);
    res.status(200).json({ message: "Terms accepted successfully" });
    return;
  } catch (error) {
    next(error);
  }
}

export async function revokeTerms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    await doRevokeTerms(userId);
    res.status(200).json({ message: "Terms consent revoked" });
    return;
  } catch (error) {
    next(error);
  }
}

export async function acceptPrivacyPolicy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    AcceptPrivacyPolicySchema.parse(req.body);
    await doAcceptPrivacyPolicy(userId);
    res.status(200).json({ message: "Privacy policy acknowledged successfully" });
    return;
  } catch (error) {
    next(error);
  }
}

export async function revokePrivacyPolicy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    await doRevokePrivacyPolicy(userId);
    res.status(200).json({ message: "Privacy policy acknowledgement revoked" });
    return;
  } catch (error) {
    next(error);
  }
}

export async function getLegalDocumentsStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUser = getAuthenticatedUser(req);
    const userId = authUser?.sub;
    if (!userId) {
      throw new HttpError(401, "UNAUTHENTICATED", "UNAUTHENTICATED");
    }
    const status = await doGetLegalDocumentsStatus(userId);
    res.status(200).json(status);
    return;
  } catch (error) {
    next(error);
  }
}

export async function getLegalDocumentVersions(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json(await doGetLegalDocumentVersions());
    return;
  } catch (error) {
    next(error);
  }
}

export function jwksHandler(_req: Request, res: Response) {
  res.json(JWKS);
}
