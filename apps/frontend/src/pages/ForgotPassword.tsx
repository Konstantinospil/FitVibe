import React, { useState, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button, InputField, TextLink } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { forgotPassword } from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword({ email });
      setSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosError.response?.data?.error?.message || t("forgotPassword.errorSend"));
      } else {
        setError(t("forgotPassword.errorSend"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        title={t("forgotPassword.titleSuccess")}
        description={t("forgotPassword.descSuccess")}
      >
        <FormStack as="div">
          <FormFeedback tone="success">{t("forgotPassword.successMessage")}</FormFeedback>
          <TextLink as={NavLink} to="/login">
            {t("forgotPassword.backToLogin")}
          </TextLink>
        </FormStack>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("forgotPassword.title")} description={t("forgotPassword.description")}>
      <FormStack
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <InputField
          label={t("forgotPassword.emailLabel")}
          name="email"
          type="email"
          placeholder={t("forgotPassword.emailPlaceholder")}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={isSubmitting}
        />
        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? t("forgotPassword.sending") : t("forgotPassword.sendLink")}
        </Button>
        <TextLink as={NavLink} to="/login">
          {t("forgotPassword.backToLogin")}
        </TextLink>
      </FormStack>
    </AuthPageLayout>
  );
};

export default ForgotPassword;
