import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button, CodeField, TextLink } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { useAuth } from "../contexts/AuthContext";
import { getAdministratorPasswordPolicyStatus, verify2FALogin } from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

type LocationState = {
  pendingSessionId?: string;
  from?: string;
};

const TwoFactorVerificationLogin: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const location = useLocation();
  const state = location.state as LocationState | null;

  const pendingSessionId = state?.pendingSessionId;
  const from = state?.from || "/";

  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if no pending session
  useEffect(() => {
    if (!pendingSessionId) {
      void navigate("/login", { replace: true });
    }
  }, [pendingSessionId, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Set submitting state synchronously before async operations
    setIsSubmitting(true);
    setError(null);

    if (!pendingSessionId) {
      setError(
        t("auth.twoFactor.invalidSession"),
      );
      setIsSubmitting(false);
      setTimeout(() => void navigate("/login", { replace: true }), 2000);
      return;
    }

    try {
      const response = await verify2FALogin({
        pendingSessionId,
        code,
      });

      // Backend has set HttpOnly cookies; just update auth state with user data
      signIn(response.user);
      if (response.user.role === "admin" || response.user.role === "superadmin") {
        // The password policy is authoritative in PostgreSQL, not the JWT or UI.
        // Any transient status failure is handled by the protected route gate.
        try {
          const status = await getAdministratorPasswordPolicyStatus();
          if (status.passwordChangeRequired) {
            void navigate("/admin/password-update", { replace: true });
            return;
          }
        } catch {
          // ProtectedRoute will independently resolve the server transition gate.
        }
      }
      void navigate(from, { replace: true });
    } catch (err) {
      // Handle specific error types
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { error?: { code?: string } } } };
        const errorCode = axiosError.response?.data?.error?.code;

        if (errorCode === "TERMS_VERSION_OUTDATED") {
          void navigate("/terms-reacceptance", { replace: true });
          return;
        }

        if (errorCode === "AUTH_INVALID_2FA_CODE") {
          setError(t("auth.twoFactor.invalidCode"));
        } else if (errorCode === "AUTH_2FA_SESSION_EXPIRED") {
          setError(t("auth.twoFactor.sessionExpired"));
          setTimeout(() => void navigate("/login", { replace: true }), 2000);
        } else {
          setError(t("auth.twoFactor.error"));
        }
      } else {
        setError(t("auth.twoFactor.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 9);
    setCode(value);
  };

  const isValidCode = /^\d{6}$/.test(code) || /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);

  const handleBackToLogin = () => {
    void navigate("/login", { replace: true });
  };

  return (
    <AuthPageLayout
      title={t("auth.twoFactor.title")}
      description={t("auth.twoFactor.description")}
    >
      <FormStack
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <FormFeedback tone="info">
          <span data-component="security-notice-content">
            <Shield aria-hidden="true" />
            <span>
              {t("auth.twoFactor.securityNotice")}
            </span>
          </span>
        </FormFeedback>

        <CodeField
          label={t("auth.twoFactor.codeLabel")}
          helperText={t("auth.twoFactor.codeHint")}
          error={error ?? undefined}
          name="code"
          inputMode="text"
          required
          value={code}
          onChange={handleCodeChange}
          autoComplete="one-time-code"
          disabled={isSubmitting}
          maxLength={9}
          autoFocus
        />

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          disabled={isSubmitting || !isValidCode}
        >
          {isSubmitting
            ? t("auth.twoFactor.verifying")
            : t("auth.twoFactor.verify")}
        </Button>

        <TextLink as="button" type="button" onClick={handleBackToLogin}>
          {t("auth.twoFactor.backToLogin")}
        </TextLink>
      </FormStack>
    </AuthPageLayout>
  );
};

export default TwoFactorVerificationLogin;
