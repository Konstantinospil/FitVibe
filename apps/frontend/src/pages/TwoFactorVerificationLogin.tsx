import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button, CodeField, TextLink } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { useAuth } from "../contexts/AuthContext";
import { verify2FALogin } from "../services/api";
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
        t("auth.twoFactor.invalidSession") || "Invalid session. Please try logging in again.",
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
          setError(t("auth.twoFactor.invalidCode") || "Invalid 2FA code. Please try again.");
        } else if (errorCode === "AUTH_2FA_SESSION_EXPIRED") {
          setError(t("auth.twoFactor.sessionExpired") || "Session expired. Please log in again.");
          setTimeout(() => void navigate("/login", { replace: true }), 2000);
        } else {
          setError(t("auth.twoFactor.error") || "Verification failed. Please try again.");
        }
      } else {
        setError(t("auth.twoFactor.error") || "Verification failed. Please try again.");
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
      title={t("auth.twoFactor.title") || "Enter Your Code"}
      description={
        t("auth.twoFactor.description") ||
        "Enter the 6-digit code from your authenticator app or use a backup code."
      }
    >
      <FormStack
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <FormFeedback tone="info">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
            }}
          >
            <Shield aria-hidden="true" />
            <span>
              {t("auth.twoFactor.securityNotice") ||
                "This extra step ensures it's really you signing in"}
            </span>
          </span>
        </FormFeedback>

        <CodeField
          label={t("auth.twoFactor.codeLabel") || "Authentication Code"}
          helperText={t("auth.twoFactor.codeHint") || "6-digit code or backup code"}
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
            ? t("auth.twoFactor.verifying") || "Verifying..."
            : t("auth.twoFactor.verify") || "Verify and Continue"}
        </Button>

        <TextLink as="button" type="button" onClick={handleBackToLogin}>
          {t("auth.twoFactor.backToLogin") || "Back to login"}
        </TextLink>
      </FormStack>
    </AuthPageLayout>
  );
};

export default TwoFactorVerificationLogin;
