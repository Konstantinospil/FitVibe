import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, InputField, TextLink } from "@fitvibe/ui";
import AuthPageLayout from "../components/AuthPageLayout";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { StatusPanel } from "../components/composites/StatusPanel";
import { startRegistration } from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

/**
 * Step 1 of email-first registration (ADR-039): only the address. The answer
 * is the same for every address; the next step arrives by email, which says
 * either how to finish creating the account or that one already exists.
 */
const Register: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const state = location.state as { email?: string } | null;
    if (state?.email) {
      setEmail(state.email);
    }
  }, [location.state]);

  const send = async (address: string) => {
    await startRegistration({ email: address, locale: i18n.language || undefined });
  };

  const describeError = (err: unknown): string => {
    if (err && typeof err === "object" && "response" in err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data
        ?.error?.code;
      if (code) {
        return t(`errors.${code}`);
      }
    }
    return t("auth.register.error");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const address = email.trim();
    if (!address) {
      setError(t("auth.register.fillAllFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      await send(address);
      setSubmittedEmail(address);
    } catch (err: unknown) {
      setError(describeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!submittedEmail) {
      return;
    }
    setIsResending(true);
    setError(null);
    setResendSent(false);
    try {
      await send(submittedEmail);
      setResendSent(true);
    } catch (err: unknown) {
      setError(describeError(err));
    } finally {
      setIsResending(false);
    }
  };

  if (submittedEmail) {
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
          {t("auth.register.checkEmail", { email: submittedEmail })}
        </StatusPanel>

        <FormStack as="div">
          {resendSent ? (
            <FormFeedback tone="success">{t("auth.register.resendSuccess")}</FormFeedback>
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
          {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
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

        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}

        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? t("auth.register.startSubmitting") : t("auth.register.startSubmit")}
        </Button>

        <p data-component="auth-supporting-prompt">
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
