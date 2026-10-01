import React, { useState, useRef } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button, PasswordField, TextLink } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { resetPassword } from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("resetPassword.passwordMismatch"));
      return;
    }

    if (!token) {
      setError(t("resetPassword.invalidToken"));
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({ token, newPassword: password });
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        void navigate("/login");
      }, 2000);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { error?: { message?: string } } } };
        setError(axiosError.response?.data?.error?.message || t("resetPassword.errorReset"));
      } else {
        setError(t("resetPassword.errorReset"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthPageLayout
        title={t("resetPassword.titleSuccess")}
        description={t("resetPassword.descSuccess")}
      >
        <FormFeedback tone="success">{t("resetPassword.successText")}</FormFeedback>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("resetPassword.title")} description={t("resetPassword.description")}>
      <FormStack
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <div
          className="rounded-md p-md text-sm text-secondary"
          style={{
            background: "var(--color-surface-glass)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="font-weight-600 mb-05">
            {t("resetPassword.passwordRequirements.title")}
          </div>
          <ul className="list">
            <li className="list-item">{t("resetPassword.passwordRequirements.minLength")}</li>
            <li className="list-item">{t("resetPassword.passwordRequirements.uppercase")}</li>
            <li className="list-item">{t("resetPassword.passwordRequirements.lowercase")}</li>
            <li className="list-item">{t("resetPassword.passwordRequirements.digit")}</li>
            <li className="list-item">{t("resetPassword.passwordRequirements.special")}</li>
          </ul>
        </div>
        <PasswordField
          label={t("resetPassword.newPasswordLabel")}
          name="password"
          placeholder={t("resetPassword.newPasswordPlaceholder")}
          required
          minLength={12}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
        />
        <PasswordField
          label={t("resetPassword.confirmPasswordLabel")}
          name="confirmPassword"
          placeholder={t("resetPassword.confirmPasswordPlaceholder")}
          required
          minLength={12}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
        />
        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? t("resetPassword.resetting") : t("resetPassword.resetButton")}
        </Button>
        <TextLink as={NavLink} to="/login">
          {t("resetPassword.backToLogin")}
        </TextLink>
      </FormStack>
    </AuthPageLayout>
  );
};

export default ResetPassword;
