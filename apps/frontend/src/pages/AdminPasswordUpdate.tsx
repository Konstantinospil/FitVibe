import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { PasswordStrengthFeedback } from "../components/PasswordStrengthFeedback";
import { Button, PasswordField } from "@fitvibe/ui";
import { FormFeedback, FormStack } from "../components/composites/FormStack";
import { changePassword } from "../services/accountApi";
import { useAuth } from "../contexts/AuthContext";

function passwordErrorCode(cause: unknown): string | undefined {
  if (!cause || typeof cause !== "object" || !("response" in cause)) {
    return undefined;
  }
  const structured = cause as { response?: { data?: { error?: { code?: string } } } };
  return structured.response?.data?.error?.code;
}

/** #557: reachable only after a verified MFA session, never a password-only bypass. */
const AdminPasswordUpdate: React.FC = () => {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmation) {
      setError(t("auth.adminPasswordTransition.mismatch"));
      return;
    }
    if (newPassword.length < 16) {
      setError(t("auth.adminPasswordTransition.minimum"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await changePassword({ currentPassword, newPassword });
      // All existing sessions are revoked by the atomic password replacement.
      // A new password + MFA login is mandatory before privileged operations.
      await signOut().catch(() => undefined);
      void navigate("/login", {
        replace: true,
        state: { passwordWarning: response?.passwordWarning ?? null, passwordUpdated: true },
      });
    } catch (cause: unknown) {
      const code = passwordErrorCode(cause);
      const known = new Set([
        "WEAK_PASSWORD",
        "PASSWORD_REUSED",
        "USER_INVALID_PASSWORD",
        "PASSWORD_COMMON",
        "PASSWORD_CONTAINS_USERNAME",
        "PASSWORD_CONTAINS_EMAIL",
      ]);
      setError(
        code && known.has(code)
          ? t(`errors.${code}`, { defaultValue: t("auth.adminPasswordTransition.failure") })
          : t("auth.adminPasswordTransition.failure"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title={t("auth.adminPasswordTransition.title")}
      description={t("auth.adminPasswordTransition.description")}
    >
      <FormStack
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <FormFeedback tone="warning">{t("auth.adminPasswordTransition.explanation")}</FormFeedback>
        <PasswordField
          id="admin-current-password"
          name="currentPassword"
          label={t("auth.adminPasswordTransition.current")}
          autoComplete="current-password"
          required
          value={currentPassword}
          disabled={submitting}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <PasswordField
          id="admin-new-password"
          name="newPassword"
          label={t("auth.adminPasswordTransition.new")}
          autoComplete="new-password"
          required
          value={newPassword}
          disabled={submitting}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordStrengthFeedback password={newPassword} minimum={16} />
        <PasswordField
          id="admin-confirm-password"
          name="confirmation"
          label={t("auth.adminPasswordTransition.confirm")}
          autoComplete="new-password"
          required
          value={confirmation}
          disabled={submitting}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
        <Button type="submit" fullWidth isLoading={submitting} disabled={submitting}>
          {t("auth.adminPasswordTransition.submit")}
        </Button>
      </FormStack>
    </AuthPageLayout>
  );
};

export default AdminPasswordUpdate;
