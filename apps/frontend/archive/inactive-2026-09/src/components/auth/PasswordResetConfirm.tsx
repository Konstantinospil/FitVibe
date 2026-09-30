import React, { useState, useRef } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/Button";
import { FormField } from "../ui";
import { Alert } from "../ui/Alert";
import { resetPassword } from "../../services/api";
import { useRequiredFieldValidation } from "../../hooks/useRequiredFieldValidation";

export interface PasswordResetConfirmProps {
  token?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * PasswordResetConfirm component for setting a new password after reset request.
 */
export const PasswordResetConfirm: React.FC<PasswordResetConfirmProps> = ({
  token: propToken,
  onSuccess,
  onError,
}) => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = propToken || searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      const errorMsg = t("resetPassword.passwordMismatch");
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (!token) {
      const errorMsg = t("resetPassword.invalidToken");
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({ token, newPassword: password });
      setSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        void navigate("/login");
      }, 2000);
    } catch (err: unknown) {
      let errorMsg = t("resetPassword.errorReset");
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
        <Alert variant="success">{t("resetPassword.successText")}</Alert>
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
      <div
        className="rounded-md p-md text-sm text-secondary"
        style={{
          background: "var(--color-surface-glass)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="font-weight-600 mb-05">{t("resetPassword.passwordRequirements.title")}</div>
        <ul className="list">
          <li className="list-item">{t("resetPassword.passwordRequirements.minLength")}</li>
          <li className="list-item">{t("resetPassword.passwordRequirements.uppercase")}</li>
          <li className="list-item">{t("resetPassword.passwordRequirements.lowercase")}</li>
          <li className="list-item">{t("resetPassword.passwordRequirements.digit")}</li>
          <li className="list-item">{t("resetPassword.passwordRequirements.special")}</li>
        </ul>
      </div>
      <div className="form-input-wrapper">
        <FormField
          label={t("resetPassword.newPasswordLabel")}
          type={showPassword ? "text" : "password"}
          placeholder={t("resetPassword.newPasswordPlaceholder")}
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
        />
        <button
          type="button"
          onMouseDown={() => setShowPassword(true)}
          onMouseUp={() => setShowPassword(false)}
          onMouseLeave={() => setShowPassword(false)}
          onTouchStart={() => setShowPassword(true)}
          onTouchEnd={() => setShowPassword(false)}
          className="form-password-toggle"
          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <div className="form-input-wrapper">
        <FormField
          label={t("resetPassword.confirmPasswordLabel")}
          type={showConfirmPassword ? "text" : "password"}
          placeholder={t("resetPassword.confirmPasswordPlaceholder")}
          required
          minLength={12}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          disabled={isSubmitting}
        />
        <button
          type="button"
          onMouseDown={() => setShowConfirmPassword(true)}
          onMouseUp={() => setShowConfirmPassword(false)}
          onMouseLeave={() => setShowConfirmPassword(false)}
          onTouchStart={() => setShowConfirmPassword(true)}
          onTouchEnd={() => setShowConfirmPassword(false)}
          className="form-password-toggle"
          aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? t("resetPassword.resetting") : t("resetPassword.resetButton")}
      </Button>
      <NavLink to="/login" className="form-link form-link--block">
        {t("resetPassword.backToLogin")}
      </NavLink>
    </form>
  );
};
