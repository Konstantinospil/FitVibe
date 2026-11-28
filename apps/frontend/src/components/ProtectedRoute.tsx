import type React from "react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getAdministratorPasswordPolicyStatus,
  getLegalDocumentsStatus,
  type LegalDocumentsStatus,
} from "../services/api";
import { takePrefetched } from "../utils/authenticatedPrefetch";

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

type PasswordGate = "checking" | "required" | "clear";

/**
 * Every guard result is stored with the identity it was fetched for. A result
 * only counts while that identity is still current, so the render after a user
 * or role change can never reuse the previous identity's legal or admin
 * clearance; it fails closed (renders nothing) until fresh results arrive.
 */
type Checked<T> = { key: string; value: T };

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isAdministrator = user?.role === "admin" || user?.role === "superadmin";
  const roleMissing = !user;
  const guardKey = !isAuthenticated
    ? "signed-out"
    : `${user?.id ?? "unknown-user"}|${roleMissing ? "role-missing" : isAdministrator ? "admin" : "member"}`;

  const [legalResult, setLegalResult] = useState<Checked<LegalDocumentsStatus | "failed"> | null>(
    null,
  );
  const [passwordResult, setPasswordResult] = useState<Checked<{
    gate: Exclude<PasswordGate, "checking">;
    minimumPasswordLength: number | null;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      return () => {
        cancelled = true;
      };
    }

    // The persisted browser session may precede hydration of user.role.
    // Ask the server rather than assuming a missing client role is non-admin.
    if (isAdministrator || roleMissing) {
      void takePrefetched("adminPasswordStatus", getAdministratorPasswordPolicyStatus)
        .then((status) => {
          if (!cancelled) {
            setPasswordResult({
              key: guardKey,
              value: {
                gate: status.passwordChangeRequired ? "required" : "clear",
                minimumPasswordLength: status.minimumPasswordLength,
              },
            });
          }
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          // A password-only bootstrap login must still reach mandatory MFA
          // enrollment before credential attestation can be requested.
          setPasswordResult({
            key: guardKey,
            value: {
              gate: authErrorCode(error) === "ADMIN_2FA_REQUIRED" ? "clear" : "required",
              minimumPasswordLength: null,
            },
          });
        });
    } else {
      setPasswordResult({ key: guardKey, value: { gate: "clear", minimumPasswordLength: null } });
    }

    void takePrefetched("legalDocumentsStatus", getLegalDocumentsStatus)
      .then((status) => {
        if (!cancelled) {
          setLegalResult({ key: guardKey, value: status });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLegalResult({ key: guardKey, value: "failed" });
        }
      });

    return () => {
      cancelled = true;
    };
    // guardKey encodes the session identity (user id) and role class.
  }, [guardKey, isAuthenticated, isAdministrator, roleMissing]);

  const currentPassword = passwordResult?.key === guardKey ? passwordResult.value : null;
  const passwordStatus = currentPassword ?? {
    gate: "checking" as const,
    minimumPasswordLength: null,
  };
  const currentLegal = legalResult?.key === guardKey ? legalResult.value : null;
  const statusFailed = currentLegal === "failed";
  const legalStatus = currentLegal === "failed" ? null : currentLegal;

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
