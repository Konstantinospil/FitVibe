import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  type LegalDocumentsStatus,
} from "../services/api";

const TERMS_GATE_ALLOWED_PATHS = new Set([
  "/terms-reacceptance",
  "/terms",
  "/privacy",
  "/cookie",
  "/impressum",
  "/contact",
  "/settings",
]);

const PRIVACY_GATE_ALLOWED_PATHS = new Set([
  "/privacy",
  "/terms",
  "/cookie",
  "/impressum",
  "/contact",
  "/settings",
]);

function authErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }
  const structured = error as { response?: { data?: { error?: { code?: string } } } };
  return structured.response?.data?.error?.code;
}

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [legalStatus, setLegalStatus] = useState<LegalDocumentsStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const isAdministrator = user?.role === "admin" || user?.role === "superadmin";
  const roleMissing = !user;
  const [passwordStatus, setPasswordStatus] = useState<{
    gate: "checking" | "required" | "clear";
    minimumPasswordLength: number | null;
  }>({ gate: "checking", minimumPasswordLength: null });

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setPasswordStatus({ gate: "checking", minimumPasswordLength: null });
      setLegalStatus(null);
      setStatusFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setPasswordStatus({ gate: "checking", minimumPasswordLength: null });
    // The persisted browser session may precede hydration of user.role.
    // Ask the server rather than assuming a missing client role is non-admin.
    if (isAdministrator || roleMissing) {
      void getAdministratorPasswordPolicyStatus()
        .then((status) => {
          if (!cancelled) {
            setPasswordStatus({
              gate: status.passwordChangeRequired ? "required" : "clear",
              minimumPasswordLength: status.minimumPasswordLength,
            });
          }
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          // A password-only bootstrap login must still reach mandatory MFA
          // enrollment before credential attestation can be requested.
          setPasswordStatus({
            gate: authErrorCode(error) === "ADMIN_2FA_REQUIRED" ? "clear" : "required",
            minimumPasswordLength: null,
          });
        });
    } else {
      setPasswordStatus({ gate: "clear", minimumPasswordLength: null });
    }

    setStatusFailed(false);
    void getLegalDocumentsStatus()
      .then((status) => {
        if (!cancelled) {
          setLegalStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLegalStatus(null);
          setStatusFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAdministrator, roleMissing, user?.id]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // The transition screen is outside MainLayout and remains reachable when
  // ordinary authenticated API calls are denied by the backend.
  if (isAdministrator || roleMissing) {
    if (passwordStatus.gate === "checking") {
      return null;
    }
    if (passwordStatus.gate === "required") {
      if (location.pathname === "/admin/password-update") {
        return <Outlet context={{ minimumPasswordLength: passwordStatus.minimumPasswordLength }} />;
      }
      return <Navigate to="/admin/password-update" replace />;
    }
    if (location.pathname === "/admin/password-update") {
      return <Navigate to="/" replace />;
    }
  }

  const pathAllowedDuringTermsGate = TERMS_GATE_ALLOWED_PATHS.has(location.pathname);

  // Fail closed for ordinary application routes if legal authority cannot be checked.
  if (statusFailed) {
    if (!pathAllowedDuringTermsGate) {
      return <Navigate to="/terms-reacceptance" replace state={{ from: location }} />;
    }
    return <Outlet />;
  }

  if (legalStatus === null) {
    return null;
  }

  if (legalStatus.terms.needsAcceptance && !pathAllowedDuringTermsGate) {
    return <Navigate to="/terms-reacceptance" replace state={{ from: location }} />;
  }

  const privacyRequiresBlockingAction =
    legalStatus.privacy.needsAcceptance &&
    (legalStatus.privacy.requiredAction === "accept" ||
      legalStatus.privacy.requiredAction === "renew_consent");

  if (privacyRequiresBlockingAction && !PRIVACY_GATE_ALLOWED_PATHS.has(location.pathname)) {
    return <Navigate to="/privacy" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
