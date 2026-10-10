import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Avatar,
  Button,
  Checkbox,
  InputField,
  PasswordField,
  SelectField,
  TextLink,
} from "@fitvibe/ui";
import AuthPageLayout from "../components/AuthPageLayout";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { StatusPanel } from "../components/composites/StatusPanel";
import { register as registerAccount, resendVerificationEmail } from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";
import { useCountdown } from "../hooks/useCountdown";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function dateYearsAgo(years: number): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

const Register: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [activityIntensity, setActivityIntensity] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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

  const handleAvatarSelection = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      setError(t("auth.register.avatarInvalidType"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t("auth.register.avatarTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (
      !name.trim() ||
      !weight.trim() ||
      !dateOfBirth ||
      !gender ||
      !activityIntensity ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError(t("auth.register.fillAllFields"));
      return;
    }

    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight) || numericWeight < 20 || numericWeight > 400) {
      setError(t("auth.register.weightInvalid"));
      return;
    }

    if (dateOfBirth > dateYearsAgo(13) || dateOfBirth < dateYearsAgo(120)) {
      setError(t("auth.register.dateOfBirthInvalid"));
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

      const registrationPayload = {
        email: email.trim(),
        password,
        username: finalUsername,
        terms_accepted: true,
        profile: {
          display_name: name.trim(),
          weight_kg: numericWeight,
          date_of_birth: dateOfBirth,
          sex: gender as "man" | "woman" | "diverse" | "prefer_not_to_say",
          fitness_level: activityIntensity as "beginner" | "intermediate" | "advanced" | "elite" | "rehab",
        },
      };

      if (avatarFile) {
        await registerAccount(registrationPayload, avatarFile);
      } else {
        await registerAccount(registrationPayload);
      }

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

        <div className="grid grid--gap-sm">
          <div className="flex flex--align-center flex--gap-md flex--wrap">
            <Avatar
              name={name.trim() || username.trim() || t("auth.register.avatarFallback")}
              src={avatarPreview ?? undefined}
              format={avatarPreview ? "photo" : "initials"}
              size="lg"
              status="unknown"
            />
            <div className="grid grid--gap-xs">
              <span className="form-label-text">{t("auth.register.photoLabel")}</span>
              <span className="text-sm text-muted">{t("auth.register.photoHelp")}</span>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            className="sr-only"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t("auth.register.photoSelect")}
            disabled={isSubmitting}
            onChange={(event) => handleAvatarSelection(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => avatarInputRef.current?.click()}
            disabled={isSubmitting}
          >
            {avatarFile ? t("auth.register.photoChange") : t("auth.register.photoSelect")}
          </Button>
        </div>

        <InputField
          label={t("auth.register.weightLabel")}
          name="weight"
          type="number"
          min="20"
          max="400"
          step="0.1"
          required
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          disabled={isSubmitting}
        />

        <InputField
          label={t("auth.register.dateOfBirthLabel")}
          name="dateOfBirth"
          type="date"
          min={dateYearsAgo(120)}
          max={dateYearsAgo(13)}
          required
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
          disabled={isSubmitting}
        />

        <SelectField
          label={t("auth.register.genderLabel")}
          name="gender"
          required
          value={gender}
          onChange={(event) => setGender(event.target.value)}
          disabled={isSubmitting}
        >
          <option value="">{t("auth.register.selectPlaceholder")}</option>
          <option value="man">{t("auth.register.genderMan")}</option>
          <option value="woman">{t("auth.register.genderWoman")}</option>
          <option value="diverse">{t("auth.register.genderDiverse")}</option>
          <option value="prefer_not_to_say">{t("auth.register.genderPreferNot")}</option>
        </SelectField>

        <SelectField
          label={t("auth.register.activityIntensityLabel")}
          helperText={t("auth.register.activityIntensityHelp")}
          name="activityIntensity"
          required
          value={activityIntensity}
          onChange={(event) => setActivityIntensity(event.target.value)}
          disabled={isSubmitting}
        >
          <option value="">{t("auth.register.selectPlaceholder")}</option>
          <option value="beginner">{t("auth.register.activityIntensityLow")}</option>
          <option value="intermediate">{t("auth.register.activityIntensityModerate")}</option>
          <option value="advanced">{t("auth.register.activityIntensityHigh")}</option>
          <option value="elite">{t("auth.register.activityIntensityVeryHigh")}</option>
          <option value="rehab">{t("auth.register.activityIntensityRehab")}</option>
        </SelectField>

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
