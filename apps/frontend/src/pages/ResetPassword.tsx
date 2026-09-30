import React, { useState, useRef } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button } from "../components/ui";
import { InputControl } from "@fitvibe/ui";
import { resetPassword } from "../services/api";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        <div className="form-success">{t("resetPassword.successText")}</div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout title={t("resetPassword.title")} description={t("resetPassword.description")}>
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
        <label className="form-label">
          <span className="form-label-text">{t("resetPassword.newPasswordLabel")}</span>
          <div className="form-input-wrapper">
            <InputControl
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("resetPassword.newPasswordPlaceholder")}
              className="form-input form-input--password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={() => setShowPassword(true)}
              onMouseUp={() => setShowPassword(false)}
              onMouseLeave={() => setShowPassword(false)}
              onTouchStart={() => setShowPassword(true)}
              onTouchEnd={() => setShowPassword(false)}
              className="form-password-toggle"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          </div>
        </label>
        <label className="form-label">
          <span className="form-label-text">{t("resetPassword.confirmPasswordLabel")}</span>
          <div className="form-input-wrapper">
            <InputControl
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              className="form-input form-input--password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={() => setShowConfirmPassword(true)}
              onMouseUp={() => setShowConfirmPassword(false)}
              onMouseLeave={() => setShowConfirmPassword(false)}
              onTouchStart={() => setShowConfirmPassword(true)}
              onTouchEnd={() => setShowConfirmPassword(false)}
              className="form-password-toggle"
              aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </Button>
          </div>
        </label>
        {error ? (
          <div role="alert" className="form-error">
            {error}
          </div>
        ) : null}
        <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? t("resetPassword.resetting") : t("resetPassword.resetButton")}
        </Button>
        <NavLink to="/login" className="form-link form-link--block">
          {t("resetPassword.backToLogin")}
        </NavLink>
      </form>
    </AuthPageLayout>
  );
};

export default ResetPassword;
