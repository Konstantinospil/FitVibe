import React, { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/Button";
import { FormField } from "../ui";
import { Alert } from "../ui/Alert";
import { register as registerAccount, resendVerificationEmail } from "../../services/api";
import { useRequiredFieldValidation } from "../../hooks/useRequiredFieldValidation";
import { useCountdown } from "../../hooks/useCountdown";

export interface RegistrationFormProps {
  onSuccess?: (email: string) => void;
  onError?: (error: string) => void;
}

/**
 * RegistrationForm component for user account creation.
 * Handles form validation, password requirements, and email verification.
 */
export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSuccess, onError }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [countdown, , resetCountdown] = useCountdown(0);

  // Pre-fill email from location state
  useEffect(() => {
    const state = location.state as { email?: string; resendVerification?: boolean } | null;
    if (state?.email) {
      setEmail(state.email);
    }
  }, [location.state]);

  // Auto-generate username from email
  useEffect(() => {
    if (email && !username) {
      const generated = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_");
      setUsername(generated);
    }
  }, [email, username]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 12) {
      errors.push(t("validation.passwordMinLength"));
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push(t("validation.passwordLowercase"));
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push(t("validation.passwordUppercase"));
    }
    if (!/\d/.test(pwd)) {
      errors.push(t("validation.passwordDigit"));
    }
    if (!/[^\w\s]/.test(pwd)) {
      errors.push(t("validation.passwordSymbol"));
    }
    return errors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      const errorMsg = t("auth.register.fillAllFields");
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      const errorMsg = t("auth.register.termsRequired");
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (password !== confirmPassword) {
      const errorMsg = t("auth.register.passwordMismatch");
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      const errorMsg = `${t("errors.WEAK_PASSWORD")}: ${passwordErrors.join(", ")}`;
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (username) {
      if (username.length < 3 || username.length > 50) {
        const errorMsg = t("errors.USER_USERNAME_INVALID");
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        const errorMsg = t("errors.USER_USERNAME_INVALID");
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const finalUsername = username.trim() || email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_");

      await registerAccount({
        email: email.trim(),
        password,
        username: finalUsername,
        terms_accepted: termsAccepted && privacyAccepted,
        profile: {
          display_name: name.trim(),
        },
      });

      setSuccess(true);
      onSuccess?.(email);
    } catch (err: unknown) {
      let errorMsg = t("auth.register.error");
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        const errorMessage = axiosError.response?.data?.error?.message;
        errorMsg = errorCode ? t(`errors.${errorCode}`) : errorMessage || errorMsg;
      }
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);
    try {
      await resendVerificationEmail({ email });
      setResendSuccess(true);
    } catch (err: unknown) {
      setResendSuccess(false);
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: {
            data?: {
              error?: { code?: string; message?: string; retryAfter?: number };
            };
            headers?: { "retry-after"?: string };
          };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        const retryAfterValue =
          axiosError.response?.data?.error?.retryAfter ||
          (axiosError.response?.headers?.["retry-after"]
            ? parseInt(axiosError.response.headers["retry-after"], 10)
            : null);

        if (errorCode === "RATE_LIMITED" && retryAfterValue) {
          setRetryAfter(retryAfterValue);
          resetCountdown(retryAfterValue);
        }

        const errorMsg =
          (errorCode
            ? t(`errors.${errorCode}`) ||
              axiosError.response?.data?.error?.message ||
              t("verifyEmail.resendError")
            : t("verifyEmail.resendError")) ?? "";
        setResendError(errorMsg || null);
      } else {
        setResendError(t("verifyEmail.resendError"));
      }
    } finally {
      setIsResending(false);
    }
  };

  if (success) {
    return (
      <div
        className="flex flex--column flex--gap-md"
        style={{ textAlign: "center", padding: "2rem" }}
      >
        <div
          className="flex flex--center"
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 1rem",
            borderRadius: "50%",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-secondary">{t("auth.register.checkEmail", { email })}</p>
        {resendSuccess ? (
          <Alert variant="success">{t("verifyEmail.resendSuccess")}</Alert>
        ) : (
          <p className="text-secondary" style={{ fontSize: "0.875rem" }}>
            {t("auth.register.didntReceiveEmail")}{" "}
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              disabled={isResending || (retryAfter !== null && countdown > 0)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent)",
                textDecoration: "underline",
                cursor: isResending ? "not-allowed" : "pointer",
                padding: 0,
                fontSize: "inherit",
              }}
            >
              {isResending ? t("verifyEmail.resending") : t("auth.register.resendEmail")}
            </button>
          </p>
        )}
        {resendError && (
          <Alert variant="danger">
            {resendError}
            {retryAfter !== null && countdown > 0 && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>
                {t("verifyEmail.retryAfter", { seconds: countdown })}
              </p>
            )}
          </Alert>
        )}
        <NavLink
          to="/login"
          style={{
            padding: "0.9rem 1.4rem",
            background: "var(--color-accent)",
            color: "#0f172a",
            fontWeight: 600,
            letterSpacing: "0.02em",
            display: "inline-block",
            borderRadius: "14px",
            textDecoration: "none",
          }}
        >
          {t("auth.register.goToLogin")}
        </NavLink>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="form"
    >
      <FormField
        label={t("auth.register.nameLabel")}
        type="text"
        placeholder={t("auth.placeholders.name")}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        disabled={isSubmitting}
      />
      <FormField
        label={t("auth.register.emailLabel")}
        type="email"
        placeholder={t("auth.placeholders.email")}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        disabled={isSubmitting}
      />
      <div>
        <FormField
          label={t("auth.register.usernameLabel")}
          type="text"
          placeholder={t("auth.placeholders.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          disabled={isSubmitting}
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9_.-]+"
        />
        <small
          className="text-secondary"
          style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}
        >
          {t("auth.register.usernameHelp")}
        </small>
      </div>
      <div>
        <label className="form-label">
          <span className="form-label-text">{t("auth.register.passwordLabel")}</span>
          <div className="form-input-wrapper">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.placeholders.password")}
              className="form-input form-input--password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="form-password-toggle"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>
      </div>
      <div>
        <label className="form-label">
          <span className="form-label-text">{t("auth.register.confirmPasswordLabel")}</span>
          <div className="form-input-wrapper">
            <input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("auth.placeholders.confirmPassword")}
              className="form-input form-input--password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="form-password-toggle"
              aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              disabled={isSubmitting}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>
      </div>
      <div className="password-requirements">
        <label
          className="checkbox-wrapper"
          style={{
            border:
              error && !termsAccepted
                ? "1px solid rgba(248, 113, 113, 0.5)"
                : "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "0.75rem",
            transition: "border-color 150ms ease",
          }}
        >
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            disabled={isSubmitting}
            style={{
              marginTop: "0.2rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            aria-invalid={error && !termsAccepted ? "true" : "false"}
          />
          <span className="checkbox-label">
            {t("auth.register.acceptTerms")}{" "}
            <NavLink
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.register.termsLink")}
            </NavLink>
          </span>
        </label>
        <label className="checkbox-wrapper">
          <input
            type="checkbox"
            checked={privacyAccepted}
            onChange={(e) => setPrivacyAccepted(e.target.checked)}
            disabled={isSubmitting}
            style={{
              marginTop: "0.2rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          />
          <span className="checkbox-label">
            {t("auth.register.acceptTerms")}{" "}
            <NavLink
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.register.privacyLink")}
            </NavLink>
          </span>
        </label>
      </div>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
      </Button>
      <p className="m-0 text-09 text-secondary text-center">
        {t("auth.register.loginPrompt")}{" "}
        <NavLink to="/login" className="text-secondary">
          {t("auth.register.loginLink")}
        </NavLink>
      </p>
    </form>
  );
};
