export { register, resendVerificationEmail, verifyEmail } from "./auth.registration.service.js";
export { login } from "./auth.login.service.js";
export { verify2FALogin } from "./auth.2fa-login.service.js";
export { refresh, logout } from "./auth.refresh.service.js";
export { requestPasswordReset, resetPassword } from "./auth.password.service.js";
export { listSessions, revokeSessions } from "./auth.sessions.service.js";
export {
  acceptTerms,
  revokeTerms,
  acceptPrivacyPolicy,
  revokePrivacyPolicy,
  getLegalDocumentsStatus,
  getLegalDocumentVersions,
  type LegalDocumentStatus,
  type LegalDocumentsStatus,
} from "./auth.legal.service.js";
