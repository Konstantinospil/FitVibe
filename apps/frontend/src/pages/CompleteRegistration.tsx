import React, { useEffect, useRef, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
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
import { PasswordStrengthFeedback } from "../components/PasswordStrengthFeedback";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { StatusPanel } from "../components/composites/StatusPanel";
import {
  completeRegistration,
  getRegistrationIntent,
  getRegistrationOptions,
  type RegistrationOptions,
} from "../services/api";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type LinkState = "checking" | "ready" | "invalid" | "expired" | "done";

function dateYearsAgo(years: number): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function usernameFromEmail(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function errorCodeOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: { code?: string } } } }).response;
    return response?.data?.error?.code;
  }
  return undefined;
}

function errorMessageOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    return response?.data?.error?.message;
  }
  return undefined;
}

/**
 * Step 2 of email-first registration (ADR-039). Reached from the link in the
 * "finish creating your account" email; the address comes from the link.
 */
const CompleteRegistration: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useRequiredFieldValidation(formRef, t);

  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [activityIntensity, setActivityIntensity] = useState("");
  const [registrationOptions, setRegistrationOptions] = useState<RegistrationOptions | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordWarning, setPasswordWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setLinkState("invalid");
      return;
    }
    void getRegistrationIntent(token)
      .then((intent) => {
        if (!active) {
          return;
        }
        setEmail(intent.email);
        setUsername((current) => current || usernameFromEmail(intent.email));
        setLinkState("ready");
      })
      .catch((err: unknown) => {
        if (active) {
          setLinkState(errorCodeOf(err) === "AUTH_TOKEN_EXPIRED" ? "expired" : "invalid");
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;
    void getRegistrationOptions()
      .then((options) => {
        if (active) {
          setRegistrationOptions(options);
        }
      })
      .catch(() => {
        if (active) {
          setError(t("auth.register.optionsLoadError"));
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

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
      !password ||
      !confirmPassword
    ) {
      setError(t("auth.register.fillAllFields"));
      return;
    }

    if (!registrationOptions) {
      setError(t("auth.register.optionsLoadError"));
      return;
    }

    const numericWeight = Number(weight);
    if (
      !Number.isFinite(numericWeight) ||
      numericWeight < registrationOptions.weight.minKg ||
      numericWeight > registrationOptions.weight.maxKg
    ) {
      setError(
        t("auth.register.weightInvalidConfigured", {
          min: registrationOptions.weight.minKg,
          max: registrationOptions.weight.maxKg,
        }),
      );
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

    // Passwords are evaluated as passphrases, not by mandatory character classes.
    if (password.length < 12 || password.length > 128) {
      setError(t("validation.passwordMinLength"));
      return;
    }

    const finalUsername = username.trim() || usernameFromEmail(email);
    if (
      finalUsername.length < 3 ||
      finalUsername.length > 50 ||
      !/^[a-zA-Z0-9_.-]+$/.test(finalUsername)
    ) {
      setError(t("errors.USER_USERNAME_INVALID"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        token,
        password,
        username: finalUsername,
        terms_accepted: true,
        profile: {
          display_name: name.trim(),
          weight_kg: numericWeight,
          date_of_birth: dateOfBirth,
          sex: gender,
          fitness_level: activityIntensity,
        },
      };
      const response = avatarFile
        ? await completeRegistration(payload, avatarFile)
        : await completeRegistration(payload);
      setPasswordWarning(response?.passwordWarning ?? null);
      setLinkState("done");
    } catch (err: unknown) {
      const code = errorCodeOf(err);
      if (code === "AUTH_TOKEN_EXPIRED") {
        setLinkState("expired");
      } else if (code === "AUTH_INVALID_TOKEN") {
        setLinkState("invalid");
      } else {
        setError(code ? t(`errors.${code}`) : errorMessageOf(err) || t("auth.register.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkState === "checking") {
    return (
      <AuthPageLayout
        title={t("auth.registerComplete.title")}
        description={t("auth.registerComplete.checking")}
      >
        <StatusPanel kind="loading">{t("auth.registerComplete.checking")}</StatusPanel>
      </AuthPageLayout>
    );
  }

  if (linkState === "invalid" || linkState === "expired") {
    const prefix = linkState === "expired" ? "expired" : "invalid";
    return (
      <AuthPageLayout
        title={t(`auth.registerComplete.${prefix}Title`)}
        description={t(`auth.registerComplete.${prefix}Description`)}
      >
        <StatusPanel
          kind="warning"
          actions={
            <TextLink as={NavLink} to="/register">
              {t("auth.registerComplete.restart")}
            </TextLink>
          }
        >
          {t(`auth.registerComplete.${prefix}Description`)}
        </StatusPanel>
      </AuthPageLayout>
    );
  }

  if (linkState === "done") {
    return (
      <AuthPageLayout
        title={t("auth.registerComplete.successTitle")}
        description={t("auth.registerComplete.successDescription")}
      >
        <StatusPanel
          kind="success"
          actions={
            <TextLink as={NavLink} to="/login">
              {t("auth.registerComplete.signIn")}
            </TextLink>
          }
        >
          {t("auth.registerComplete.successDescription")}
        </StatusPanel>
        {passwordWarning ? (
          <FormFeedback tone="warning">
            {t(`passwordStrength.advisory.${passwordWarning}`)}
          </FormFeedback>
        ) : null}
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title={t("auth.registerComplete.title")}
      description={t("auth.registerComplete.description")}
    >
      <FormStack
        ref={formRef}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <InputField
          label={t("auth.register.emailLabel")}
          helperText={t("auth.registerComplete.emailHelp")}
          name="email"
          type="email"
          value={email}
          readOnly
          autoComplete="email"
        />

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
          min={registrationOptions?.weight.minKg}
          max={registrationOptions?.weight.maxKg}
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
          {registrationOptions?.genders.map((option) => (
            <option key={option.code} value={option.code}>
              {option.description}
            </option>
          ))}
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
          {registrationOptions?.fitnessLevels.map((option) => (
            <option key={option.code} value={option.code}>
              {option.description}
            </option>
          ))}
        </SelectField>

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
        <PasswordStrengthFeedback password={password} />

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
      </FormStack>
    </AuthPageLayout>
  );
};

export default CompleteRegistration;
