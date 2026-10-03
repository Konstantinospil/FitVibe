import React, { useState, useRef } from "react";
import { useNavigate, useLocation, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button, InputField, PasswordField, TextLink } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { useAuth } from "../contexts/AuthContext";
import { login } from "../services/api";
import { logger } from "../utils/logger.js";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const LoginFormContent: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const location = useLocation();
  const requestedPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const from =
    typeof requestedPath === "string" &&
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.includes("://")
      ? requestedPath
      : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPasswordLabel = t("auth.login.showPassword", {
    defaultValue: t("auth.showPassword", { defaultValue: "Show password" }),
  });
  const hidePasswordLabel = t("auth.login.hidePassword", {
    defaultValue: t("auth.hidePassword", { defaultValue: "Hide password" }),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validate inputs
    if (!email.trim() || !password) {
      setError(t("auth.login.fillAllFields") || "Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await login({ email: email.trim(), password });

      if (response.requires2FA) {
        // Navigate to 2FA verification page
        void navigate("/login/verify-2fa", {
          state: {
            pendingSessionId: response.pendingSessionId,
            from,
          },
          replace: false,
        });
        return;
      }

      // Login successful - sign in and navigate
      if (response.user) {
        signIn(response.user);
        void navigate(from, { replace: true });
      } else {
        setError(t("auth.login.error") || "Login failed. Please try again.");
      }
    } catch (err: unknown) {
      logger.error("Login error", err instanceof Error ? err : new Error(String(err)), {
        context: "login",
      });

      // Handle terms version outdated error
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: {
            data?: {
              error?: {
                code?: string;
                message?: string;
                details?: Record<string, unknown>;
              };
            };
          };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        const errorMessage = axiosError.response?.data?.error?.message;
        if (errorCode === "TERMS_VERSION_OUTDATED") {
          void navigate("/terms-reacceptance", { replace: true });
          return;
        }

        const concealableAuthFailure =
          errorCode === "AUTH_INVALID_CREDENTIALS" ||
          errorCode === "AUTH_ACCOUNT_LOCKED" ||
          errorCode === "AUTH_IP_LOCKED";

        if (concealableAuthFailure) {
          setError(t("auth.login.error") || "Login failed. Please try again.");
        } else if (errorMessage) {
          setError(errorMessage);
        } else if (errorCode) {
          const translatedError = t(`errors.${errorCode}`);
          setError(
            translatedError !== `errors.${errorCode}` ? translatedError : t("auth.login.error"),
          );
        } else {
          setError(t("auth.login.error") || "Login failed. Please check your credentials.");
        }
      } else {
        // Network error or other issues
        setError(
          t("auth.login.error") ||
            "Unable to connect to server. Please check if the backend is running.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormStack
      ref={formRef}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <InputField
        label={t("auth.login.emailLabel")}
        name="email"
        type="text"
        placeholder={t("auth.placeholders.email")}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="username"
        disabled={isSubmitting}
      />
      <PasswordField
        id="login-password"
        label={t("auth.login.passwordLabel")}
        name="password"
        placeholder={t("auth.placeholders.password")}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        disabled={isSubmitting}
        showPasswordLabel={showPasswordLabel}
        hidePasswordLabel={hidePasswordLabel}
      />
      {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
      <Button type="submit" fullWidth isLoading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
      <div className="form-links">
        <TextLink as={NavLink} to="/register">
          {t("auth.login.registerPrompt")}
        </TextLink>
        <TextLink as={NavLink} to="/forgot-password">
          {t("auth.login.forgot")}
        </TextLink>
      </div>
    </FormStack>
  );
};

export default LoginFormContent;
