import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getLegalDocumentsStatus, type LegalDocumentsStatus } from "../services/api";

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

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [legalStatus, setLegalStatus] = useState<LegalDocumentsStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setLegalStatus(null);
      setStatusFailed(false);
      return () => {
        cancelled = true;
      };
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
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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
