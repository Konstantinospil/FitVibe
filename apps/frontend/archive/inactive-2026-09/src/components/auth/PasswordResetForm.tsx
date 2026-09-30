import React, { useState, useRef } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { FormField } from "../ui";
import { Alert } from "../ui/Alert";
import { forgotPassword } from "../../services/api";
import { useRequiredFieldValidation } from "../../hooks/useRequiredFieldValidation";

export interface PasswordResetFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * PasswordResetForm component for requesting password reset emails.
 */
export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onSuccess, onError }) => {
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
      onSuccess?.();
    } catch (err: unknown) {
      let errorMsg = t("forgotPassword.errorSend");
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
        errorMsg = axiosError.response?.data?.error?.message || errorMsg;
      }
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex--column flex--gap-md">
        <Alert variant="success">{t("forgotPassword.successMessage")}</Alert>
        <NavLink
          to="/login"
          style={{
            padding: "0.9rem 1.4rem",
            background: "var(--color-primary)",
            color: "var(--color-primary-on)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            display: "inline-block",
            borderRadius: "14px",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {t("forgotPassword.backToLogin")}
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
        label={t("forgotPassword.emailLabel")}
        type="email"
        placeholder={t("forgotPassword.emailPlaceholder")}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        disabled={isSubmitting}
      />
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? t("forgotPassword.sending") : t("forgotPassword.sendLink")}
      </Button>
      <NavLink to="/login" className="form-link form-link--block">
        {t("forgotPassword.backToLogin")}
      </NavLink>
    </form>
  );
};
