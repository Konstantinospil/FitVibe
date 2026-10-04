import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, InputField, PasswordField, TextLink } from "@fitvibe/ui";
import AuthPageLayout from "../components/AuthPageLayout";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { StatusPanel } from "../components/composites/StatusPanel";
import { register as registerAccount, resendVerificationEmail } from "../services/api";
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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  useEffect(() => {
    const state = location.state as { email?: string; resendVerification?: boolean } | null;
    if (state?.email) {
      setEmail(state.email);
    }
  }, [location.state]);

  useEffect(() => {
    if (email && !username) {
      setUsername(email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_"));
    }
  }, [email, username]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError(t("auth.register.fillAllFields"));
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError(t("auth.register.termsRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }

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

    if (username) {
      if (username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
        setError(t("errors.USER_USERNAME_INVALID"));
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
        terms_accepted: true,
        profile: { display_name: name.trim() },
      });

      setSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        const errorMessage = axiosError.response?.data?.error?.message;
        setError(errorCode ? t(`errors.${errorCode}`) : errorMessage || t("auth.register.error"));
      } else {
        setError(t("auth.register.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      await resendVerificationEmail({ email });
      setResendSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: {
            data?: { error?: { code?: string; message?: string; retryAfter?: number } };
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

        const errorMessage =
          (errorCode
            ? t(`errors.${errorCode}`) ||
              axiosError.response?.data?.error?.message ||
              t("verifyEmail.resendError")
            : t("verifyEmail.resendError")) ?? "";
        setResendError(errorMessage || null);
      } else {
        setResendError(t("verifyEmail.resendError"));
      }
    } finally {
      setIsResending(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        title={t("auth.register.successTitle")}
        description={t("auth.register.successDescription")}
      >
        <StatusPanel
          kind="success"
          actions={
            <TextLink as={NavLink} to="/login">
              {t("auth.register.goToLogin")}
            </TextLink>
          }
        >
          {t("auth.register.checkEmail", { email })}
        </StatusPanel>

        <FormStack as="div">
          {resendSuccess ? (
            <FormFeedback tone="success">{t("verifyEmail.resendSuccess")}</FormFeedback>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleResend()}
              disabled={isResending}
              isLoading={isResending}
            >
              {t("auth.register.didntReceiveEmail")} {t("auth.register.resendEmail")}
            </Button>
          )}

          {resendError ? (
            <FormFeedback tone="danger">
              {resendError}
              {retryAfter !== null && countdown > 0
                ? ` ${t("verifyEmail.retryAfter", { seconds: countdown })}`
                : ""}
            </FormFeedback>
          ) : null}
        </FormStack>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("auth.register.title")} description={t("auth.register.description")}>
      <FormStack
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <InputField
          label={t("auth.register.nameLabel")}
          name="name"
          type="text"
          placeholder={t("auth.placeholders.name")}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          disabled={isSubmitting}
        />

        <InputField
          label={t("auth.register.emailLabel")}
          name="email"
          type="email"
          placeholder={t("auth.placeholders.email")}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={isSubmitting}
        />

        <InputField
          id="register-username"
          label={t("auth.register.usernameLabel")}
          helperText={t("auth.register.usernameHelp")}
          name="username"
          type="text"
          placeholder={t("auth.placeholders.username")}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          disabled={isSubmitting}
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9_.-]+"
        />

        <PasswordField
          id="register-password"
          label={t("auth.register.passwordLabel")}
          name="password"
          placeholder={t("auth.placeholders.password")}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
        />

        <PasswordField
          id="register-confirm-password"
          label={t("auth.register.confirmPasswordLabel")}
          name="confirmPassword"
          placeholder={t("auth.placeholders.confirmPassword")}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
        />

        <Checkbox
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          disabled={isSubmitting}
          error={error && !termsAccepted ? t("auth.register.termsRequired") : undefined}
          label={
            <span>
              {t("auth.register.acceptTerms")}{" "}
              <TextLink
                as={NavLink}
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t("auth.register.termsLink")}
              </TextLink>
            </span>
          }
        />

        <Checkbox
          checked={privacyAccepted}
          onChange={(event) => setPrivacyAccepted(event.target.checked)}
          disabled={isSubmitting}
          label={
            <span>
              {t("auth.register.acceptTerms")}{" "}
              <TextLink
                as={NavLink}
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t("auth.register.privacyLink")}
              </TextLink>
            </span>
          }
        />

        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}

        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>

        <p
          style={{
            margin: 0,
            textAlign: "center",
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontSize: "var(--type-supporting-size)",
            lineHeight: "var(--type-supporting-line-height)",
          }}
        >
          {t("auth.register.loginPrompt")}{" "}
          <TextLink as={NavLink} to="/login">
            {t("auth.register.loginLink")}
          </TextLink>
        </p>
      </FormStack>
    </AuthPageLayout>
  );
};

export default Register;
