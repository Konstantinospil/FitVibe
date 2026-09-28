import { Router } from "express";
import {
  register,
  login,
  verify2FALogin,
  refresh,
  logout,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  listSessions,
  revokeSessions,
  acceptTerms,
  revokeTerms,
  acceptPrivacyPolicy,
  revokePrivacyPolicy,
  getLegalDocumentsStatus,
  getLegalDocumentVersions,
  jwksHandler,
} from "./auth.controller.js";
// Removed twofa.controller imports - using two-factor.controller via two-factor.routes.ts instead
import { rateLimit } from "../common/rateLimiter.js";
import { validate } from "../../utils/validation.js";
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
import { requireAccessToken } from "./auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import twoFactorRoutes from "./two-factor.routes.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  rateLimit("auth_register"),
  validate(RegisterSchema),
  asyncHandler(register),
);
authRouter.get("/verify", rateLimit("auth_verify"), asyncHandler(verifyEmail));
authRouter.post(
  "/verify/resend",
  rateLimit("auth_verify_resend"), // 3 requests per hour
  validate(ResendVerificationSchema),
  asyncHandler(resendVerificationEmail),
);
authRouter.post(
  "/login",
  rateLimit("auth_login"),
  validate(LoginSchema),
  asyncHandler(login),
);
authRouter.post(
  "/login/verify-2fa",
  rateLimit("auth_2fa_login"),
  validate(Verify2FALoginSchema),
  asyncHandler(verify2FALogin),
);
authRouter.post("/refresh", rateLimit("auth_refresh"), asyncHandler(refresh));
authRouter.post("/logout", rateLimit("auth_logout"), asyncHandler(logout));
authRouter.post(
  "/password/forgot",
  rateLimit("auth_pw_forgot"),
  validate(ForgotPasswordSchema),
  asyncHandler(forgotPassword),
);
authRouter.post(
  "/password/reset",
  rateLimit("auth_pw_reset"),
  validate(ResetPasswordSchema),
  asyncHandler(resetPassword),
);

authRouter.get(
  "/sessions",
  rateLimit("auth_sessions"),
  requireAccessToken,
  asyncHandler(listSessions),
);
authRouter.post(
  "/sessions/revoke",
  rateLimit("auth_sessions_revoke"),
  requireAccessToken,
  validate(RevokeSessionsSchema),
  asyncHandler(revokeSessions),
);
authRouter.post(
  "/terms/accept",
  rateLimit("auth_terms_accept"),
  requireAccessToken,
  validate(AcceptTermsSchema),
  asyncHandler(acceptTerms),
);
authRouter.post(
  "/terms/revoke",
  rateLimit("auth_terms_revoke"),
  requireAccessToken,
  asyncHandler(revokeTerms),
);
authRouter.post(
  "/privacy/accept",
  rateLimit("auth_privacy_accept"),
  requireAccessToken,
  validate(AcceptPrivacyPolicySchema),
  asyncHandler(acceptPrivacyPolicy),
);
authRouter.post(
  "/privacy/revoke",
  rateLimit("auth_privacy_revoke"),
  requireAccessToken,
  asyncHandler(revokePrivacyPolicy),
);
authRouter.get(
  "/legal-documents/versions",
  rateLimit("auth_legal_versions"),
  asyncHandler(getLegalDocumentVersions),
);
authRouter.get(
  "/legal-documents/status",
  rateLimit("auth_legal_status"),
  requireAccessToken,
  asyncHandler(getLegalDocumentsStatus),
);

authRouter.get("/jwks", asyncHandler(jwksHandler));

// Two-Factor Authentication routes
// All 2FA routes are handled by two-factor.routes.ts (mounted at /2fa)
// Removed duplicate route definitions that were never reached (dead code)
authRouter.use("/2fa", twoFactorRoutes);
