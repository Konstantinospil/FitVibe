import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
import { changePassword, get2FAStatus, disable2FA } from "../../services/api";
import { useToast } from "../ui/Toast";
import { TwoFactorSetup } from "../auth/TwoFactorSetup";

export interface SecuritySettingsProps {
  onUpdate?: () => void;
}

/**
 * SecuritySettings component for managing password and 2FA.
 * Handles password change and 2FA enable/disable.
 */
export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ onUpdate }) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorBackupCodesRemaining, setTwoFactorBackupCodesRemaining] = useState<
    number | undefined
  >();

  useEffect(() => {
    const load2FAStatus = async () => {
      try {
        const status = await get2FAStatus();
        setTwoFactorEnabled(status.enabled);
        setTwoFactorBackupCodesRemaining(status.backupCodesRemaining);
      } catch {
        // Ignore errors
      }
    };
    void load2FAStatus();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t("settings.security.passwordsDoNotMatch") || "Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 12) {
      setError(
        t("settings.security.passwordTooShort") || "Password must be at least 12 characters",
      );
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast({
        variant: "success",
        title: t("settings.security.passwordChanged") || "Password Changed",
        message:
          t("settings.security.passwordChangedMessage") ||
          "Your password has been changed successfully",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onUpdate?.();
    } catch {
      setError(
        t("settings.security.passwordChangeFailed") ||
          "Failed to change password. Please check your current password.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDisable2FA = async () => {
    const password = prompt(
      t("settings.security.enterPasswordToDisable2FA") || "Enter your password to disable 2FA:",
    );
    if (!password) {
      return;
    }
    const code = prompt(
      t("settings.security.enter2FAToDisable") || "Enter your current 2FA or backup code:",
    );
    if (!code) {
      return;
    }

    setIsDisabling2FA(true);
    setError(null);

    try {
      await disable2FA({ password, code });
      setTwoFactorEnabled(false);
      showToast({
        variant: "success",
        title: t("settings.security.2FADisabled") || "2FA Disabled",
        message:
          t("settings.security.2FADisabledMessage") ||
          "Two-factor authentication has been disabled",
      });
      onUpdate?.();
    } catch {
      setError(
        t("settings.security.2FADisableFailed") ||
          "Failed to disable 2FA. Check your password and current 2FA code.",
      );
    } finally {
      setIsDisabling2FA(false);
    }
  };

  if (show2FASetup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {t("settings.security.setup2FA") || "Setup Two-Factor Authentication"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup
            onSetupComplete={() => {
              setShow2FASetup(false);
              setTwoFactorEnabled(true);
              onUpdate?.();
            }}
            onCancel={() => setShow2FASetup(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.security.title") || "Security Settings"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-lg">
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Password Change Section */}
          <div>
            <h3
              style={{
                marginBottom: "var(--space-md)",
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
              }}
            >
              {t("settings.security.changePassword") || "Change Password"}
            </h3>
            <form
              onSubmit={(e) => {
                void handlePasswordChange(e);
              }}
              className="flex flex--column flex--gap-md"
            >
              <Input
                label={t("settings.security.currentPassword") || "Current Password"}
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
                required
              />
              <Input
                label={t("settings.security.newPassword") || "New Password"}
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                helperText={t("settings.security.passwordRequirements") || "Minimum 12 characters"}
                required
              />
              <Input
                label={t("settings.security.confirmPassword") || "Confirm New Password"}
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                required
              />
              <Button type="submit" variant="primary" isLoading={isChangingPassword}>
                {t("settings.security.updatePassword") || "Update Password"}
              </Button>
            </form>
          </div>

          <div
            style={{
              height: "1px",
              background: "var(--color-border)",
              margin: "var(--space-lg) 0",
            }}
          />

          {/* 2FA Section */}
          <div>
            <h3
              style={{
                marginBottom: "var(--space-md)",
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
              }}
            >
              {t("settings.security.twoFactorAuth") || "Two-Factor Authentication"}
            </h3>
            {twoFactorEnabled ? (
              <div className="flex flex--column flex--gap-md">
                <Alert variant="success">
                  {t("settings.security.2FAEnabled") || "Two-factor authentication is enabled"}
                  {twoFactorBackupCodesRemaining !== undefined && (
                    <div style={{ marginTop: "var(--space-xs)", fontSize: "var(--font-size-sm)" }}>
                      {t("settings.security.backupCodesRemaining", {
                        count: twoFactorBackupCodesRemaining,
                      }) || `${twoFactorBackupCodesRemaining} backup codes remaining`}
                    </div>
                  )}
                </Alert>
                <Button
                  variant="danger"
                  onClick={() => {
                    void handleDisable2FA();
                  }}
                  isLoading={isDisabling2FA}
                >
                  {t("settings.security.disable2FA") || "Disable 2FA"}
                </Button>
              </div>
            ) : (
              <div className="flex flex--column flex--gap-md">
                <Alert variant="info">
                  {t("settings.security.2FADescription") ||
                    "Add an extra layer of security to your account by enabling two-factor authentication"}
                </Alert>
                <Button variant="primary" onClick={() => setShow2FASetup(true)}>
                  {t("settings.security.enable2FA") || "Enable 2FA"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
