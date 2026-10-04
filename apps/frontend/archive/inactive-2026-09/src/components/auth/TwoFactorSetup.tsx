import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
import { setup2FA, verify2FA, get2FAStatus } from "../../services/api";
import { useToast } from "../ui/Toast";
import { BackupCodesDisplay } from "./BackupCodesDisplay";

export interface TwoFactorSetupProps {
  onSetupComplete?: () => void;
  onCancel?: () => void;
}

/**
 * TwoFactorSetup component for 2FA setup wizard.
 * Handles QR code display, verification, and backup codes.
 */
export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onSetupComplete, onCancel }) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [step, setStep] = useState<"setup" | "verify" | "backup">("setup");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await get2FAStatus();
        setIsEnabled(status.enabled);
        if (status.enabled) {
          setStep("backup");
        }
      } catch {
        // Ignore errors
      }
    };
    void checkStatus();
  }, []);

  const handleSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await setup2FA();
      setQrCode(response.qrCode);
      setSecret(response.secret);
      setBackupCodes(response.backupCodes);
      setStep("verify");
    } catch {
      setError(t("auth.2fa.setupFailed") || "Failed to setup 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t("auth.2fa.invalidCode") || "Please enter a valid 6-digit code");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await verify2FA(verificationCode);
      if (response.success) {
        setStep("backup");
        showToast({
          variant: "success",
          title: t("auth.2fa.verified") || "2FA Enabled",
          message: t("auth.2fa.verifiedMessage") || "Two-factor authentication has been enabled",
        });
      } else {
        setError(response.message || t("auth.2fa.verificationFailed") || "Verification failed");
      }
    } catch {
      setError(t("auth.2fa.verificationFailed") || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleComplete = () => {
    onSetupComplete?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.2fa.setup") || "Setup Two-Factor Authentication"}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="danger" style={{ marginBottom: "var(--space-lg)" }}>
            {error}
          </Alert>
        )}

        {step === "setup" && (
          <div className="flex flex--column flex--gap-lg">
            <Alert variant="info">
              {t("auth.2fa.setupDescription") ||
                "Two-factor authentication adds an extra layer of security to your account. You'll need an authenticator app like Google Authenticator or Authy."}
            </Alert>

            {isEnabled ? (
              <Alert variant="success">
                {t("auth.2fa.alreadyEnabled") || "2FA is already enabled on your account"}
              </Alert>
            ) : (
              <div className="flex flex--column flex--gap-md">
                <p style={{ color: "var(--color-text-muted)" }}>
                  {t("auth.2fa.setupSteps") ||
                    "1. Install an authenticator app on your phone\n2. Scan the QR code\n3. Enter the verification code"}
                </p>
                <Button
                  variant="primary"
                  onClick={() => void handleSetup()}
                  isLoading={isLoading}
                  fullWidth
                >
                  {t("auth.2fa.startSetup") || "Start Setup"}
                </Button>
              </div>
            )}

            {onCancel && (
              <Button variant="ghost" onClick={onCancel} fullWidth>
                {t("common.cancel") || "Cancel"}
              </Button>
            )}
          </div>
        )}

        {step === "verify" && (
          <div className="flex flex--column flex--gap-lg">
            <div className="flex flex--column flex--center flex--gap-md">
              <div
                style={{
                  padding: "var(--space-lg)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="QR Code"
                    style={{ width: "200px", height: "200px", display: "block" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "200px",
                      height: "200px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AlertCircle size={48} style={{ color: "var(--color-text-muted)" }} />
                  </div>
                )}
              </div>

              {secret && (
                <div style={{ width: "100%" }}>
                  <p
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-muted)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    {t("auth.2fa.secretKey") || "Or enter this code manually:"}
                  </p>
                  <code
                    style={{
                      display: "block",
                      padding: "var(--space-sm)",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-family-mono)",
                      fontSize: "var(--font-size-sm)",
                      textAlign: "center",
                    }}
                  >
                    {secret}
                  </code>
                </div>
              )}
            </div>

            <div>
              <Input
                label={t("auth.2fa.verificationCode") || "Verification Code"}
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setVerificationCode(value);
                }}
                placeholder="000000"
                maxLength={6}
                style={{
                  textAlign: "center",
                  fontSize: "var(--font-size-xl)",
                  letterSpacing: "0.2em",
                }}
              />
            </div>

            <div className="flex flex--gap-sm">
              <Button variant="ghost" onClick={() => setStep("setup")} fullWidth>
                {t("common.back") || "Back"}
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleVerify()}
                isLoading={isVerifying}
                disabled={verificationCode.length !== 6}
                fullWidth
              >
                {t("auth.2fa.verify") || "Verify"}
              </Button>
            </div>
          </div>
        )}

        {step === "backup" && (
          <div className="flex flex--column flex--gap-lg">
            <Alert variant="success">
              <div className="flex flex--align-center flex--gap-sm">
                <CheckCircle size={20} />
                <span>{t("auth.2fa.setupComplete") || "2FA has been successfully enabled!"}</span>
              </div>
            </Alert>

            {backupCodes.length > 0 && (
              <BackupCodesDisplay
                backupCodes={backupCodes}
                onCodesCopied={() => {
                  showToast({
                    variant: "success",
                    title: t("common.copied") || "Copied",
                    message: t("auth.2fa.codesCopied") || "Backup codes copied to clipboard",
                  });
                }}
              />
            )}

            <Button variant="primary" onClick={handleComplete} fullWidth>
              {t("common.done") || "Done"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
