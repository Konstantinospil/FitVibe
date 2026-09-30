import React, { useState, useRef, useEffect } from "react";
import AuthPageLayout from "../components/AuthPageLayout";
import { NavLink, useLocation } from "react-router-dom";
import { register as registerAccount, resendVerificationEmail } from "../services/api";
import { Button } from "../components/ui";
import { InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";
import { useCountdown } from "../hooks/useCountdown";

const Register: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  // Pre-fill email from location state (e.g., from expired verification token)
  useEffect(() => {
    const state = location.state as { email?: string; resendVerification?: boolean } | null;
    if (state?.email) {
      setEmail(state.email);
    }
  }, [location.state]);

  // Auto-generate username from email when email changes
  useEffect(() => {
    if (email && !username) {
      const generated = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_");
      setUsername(generated);
    }
  }, [email, username]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Validate required fields
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t("auth.register.fillAllFields"));
      return;
    }

    // Check if terms and privacy are accepted
    if (!termsAccepted || !privacyAccepted) {
      setError(t("auth.register.termsRequired"));
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }

    // Validate password strength
    const passwordErrors: string[] = [];
    if (password.length < 12) {
      passwordErrors.push(t("validation.passwordMinLength"));
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push(t("validation.passwordLowercase"));
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push(t("validation.passwordUppercase"));
    }
    if (!/\d/.test(password)) {
      passwordErrors.push(t("validation.passwordDigit"));
    }
    if (!/[^\w\s]/.test(password)) {
      passwordErrors.push(t("validation.passwordSymbol"));
    }

    if (passwordErrors.length > 0) {
      setError(t("errors.WEAK_PASSWORD") + ": " + passwordErrors.join(", "));
      return;
    }

    // Validate username if provided
    if (username) {
      if (username.length < 3 || username.length > 50) {
        setError(t("errors.USER_USERNAME_INVALID"));
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        setError(t("errors.USER_USERNAME_INVALID"));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Use provided username or generate from email
      const finalUsername = username.trim() || email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_");

      await registerAccount({
        email: email.trim(),
        password,
        username: finalUsername,
        terms_accepted: true, // Both termsAccepted and privacyAccepted are already validated above
        profile: {
          display_name: name.trim(),
        },
      });

      // Registration successful - show success message
      setSuccess(true);
    } catch (err: unknown) {
      // Show more specific error if available
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        const errorMessage = axiosError.response?.data?.error?.message;
        // Use error code translation if available, otherwise use error message, otherwise fallback
        setError(errorCode ? t(`errors.${errorCode}`) : errorMessage || t("auth.register.error"));
      } else {
        setError(t("auth.register.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        title={t("auth.register.successTitle")}
        description={t("auth.register.successDescription")}
      >
        <div className="text-center p-2rem">
          <div
            className="flex flex--center mb-1"
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 1rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--surface-success-subtle)",
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
          <p className="mb-1 text-secondary">{t("auth.register.checkEmail", { email })}</p>
          {resendSuccess ? (
            <div className="mb-1">
              <p
                style={{
                  color: "var(--color-success)",
                  marginBottom: "1rem",
                  fontSize: "var(--type-supporting-size)",
                }}
              >
                {t("verifyEmail.resendSuccess")}
              </p>
            </div>
          ) : (
            <p className="mb-1 text-secondary" style={{ fontSize: "var(--type-supporting-size)" }}>
              {t("auth.register.didntReceiveEmail")}{" "}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void (async () => {
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
                  })();
                }}
                disabled={isResending}
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
              </Button>
            </p>
          )}
          {resendError && (
            <div role="alert" style={{ marginBottom: "1rem" }}>
              <p
                style={{
                  color: "var(--color-danger)",
                  fontSize: "var(--type-supporting-size)",
                  marginBottom: "0.25rem",
                }}
              >
                {resendError}
              </p>
              {retryAfter !== null && countdown > 0 && (
                <p style={{ color: "var(--color-text-muted)", fontSize: "var(--type-supporting-size)" }}>
                  {t("verifyEmail.retryAfter", { seconds: countdown })}
                </p>
              )}
            </div>
          )}
          <NavLink
            to="/login"
            className="rounded-xl"
            style={{
              padding: "0.9rem 1.4rem",
              background: "var(--color-accent)",
              color: "var(--color-primary-on)",
              fontWeight: "var(--font-weight-semibold)",
              letterSpacing: "var(--type-metric-small-letter-spacing)",
              display: "inline-block",
            }}
          >
            {t("auth.register.goToLogin")}
          </NavLink>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("auth.register.title")} description={t("auth.register.description")}>
      <form
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="form"
      >
        <label className="form-label">
          <span className="form-label-text">{t("auth.register.nameLabel")}</span>
          <InputControl
            name="name"
            type="text"
            placeholder={t("auth.placeholders.name")}
            className="form-input"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            disabled={isSubmitting}
          />
        </label>
        <label className="form-label">
          <span className="form-label-text">{t("auth.register.emailLabel")}</span>
          <InputControl
            name="email"
            type="email"
            placeholder={t("auth.placeholders.email")}
            className="form-input"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={isSubmitting}
          />
        </label>
        <div className="form-label">
          <label htmlFor="register-username" className="form-label-text">
            {t("auth.register.usernameLabel")}
          </label>
          <InputControl
            id="register-username"
            name="username"
            type="text"
            placeholder={t("auth.placeholders.username")}
            className="form-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            disabled={isSubmitting}
            minLength={3}
            maxLength={50}
            pattern="[a-zA-Z0-9_.-]+"
          />
          <small
            className="text-secondary"
            style={{
              fontSize: "var(--type-supporting-size)",
              marginTop: "0.25rem",
              display: "block",
            }}
          >
            {t("auth.register.usernameHelp")}
          </small>
        </div>
        <div className="form-label">
          <label htmlFor="register-password" className="form-label-text">
            {t("auth.register.passwordLabel")}
          </label>
          <div className="form-input-wrapper">
            <InputControl
              id="register-password"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="form-password-toggle"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              disabled={isSubmitting}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          </div>
        </div>
        <div className="form-label">
          <label htmlFor="register-confirm-password" className="form-label-text">
            {t("auth.register.confirmPasswordLabel")}
          </label>
          <div className="form-input-wrapper">
            <InputControl
              id="register-confirm-password"
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="form-password-toggle"
              aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              disabled={isSubmitting}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          </div>
        </div>
        <div className="password-requirements">
          <label
            className="checkbox-wrapper"
            style={{
              border:
                error && !termsAccepted
                  ? "1px solid var(--border-danger-subtle)"
                  : "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
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
        {error ? (
          <div role="alert" className="form-error">
            {error}
          </div>
        ) : null}
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
    </AuthPageLayout>
  );
};

export default Register;
