import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Mail, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Alert } from "../ui/Alert";
import { resendVerificationEmail, verifyEmailToken } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface EmailVerificationProps {
  onVerified?: () => void;
}

/**
 * EmailVerification component for email verification flow.
 * Handles verification token from URL and resend functionality.
 */
export const EmailVerification: React.FC<EmailVerificationProps> = ({ onVerified }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState<"pending" | "verifying" | "verified" | "error">("pending");
  const [error, setError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState<string>("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setStatus("verifying");

    void verifyEmailToken(token)
      .then(() => {
        if (cancelled) {
          return;
        }
        setStatus("verified");
        onVerified?.();
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(
          t("auth.verification.errorDescription") || "The verification link is invalid or expired",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [token, onVerified, t]);

  const handleResend = async () => {
    if (!email) {
      setError(t("auth.verification.emailRequired") || "Email address is required");
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      await resendVerificationEmail({ email });
      showToast({
        variant: "success",
        title: t("auth.verification.emailSent") || "Verification email sent",
        message: t("auth.verification.checkInbox") || "Please check your inbox",
      });
    } catch {
      setError(t("auth.verification.resendFailed") || "Failed to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: "500px",
    margin: "0 auto",
  };

  return (
    <div style={cardStyle}>
      <Card>
        <CardContent>
          <div
            className="flex flex--column flex--center flex--gap-lg"
            style={{ padding: "var(--space-xl)", textAlign: "center" }}
          >
            {status === "pending" && (
              <>
                <Mail size={64} style={{ color: "var(--color-text-muted)" }} />
                <div>
                  <h2 style={{ margin: 0, marginBottom: "var(--space-sm)" }}>
                    {t("auth.verification.title") || "Verify Your Email"}
                  </h2>
                  <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
                    {t("auth.verification.description") ||
                      "Please check your email and click the verification link"}
                  </p>
                </div>
                <div style={{ width: "100%" }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.verification.emailPlaceholder") || "Enter your email"}
                    className="form-input"
                    style={{ marginBottom: "var(--space-md)" }}
                  />
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => void handleResend()}
                    isLoading={isResending}
                    leftIcon={<RefreshCw size={18} />}
                  >
                    {t("auth.verification.resend") || "Resend Verification Email"}
                  </Button>
                </div>
              </>
            )}

            {status === "verifying" && (
              <>
                <div className="spinner" style={{ width: "48px", height: "48px" }} />
                <h2 style={{ margin: 0 }}>{t("auth.verification.verifying") || "Verifying..."}</h2>
              </>
            )}

            {status === "verified" && (
              <>
                <CheckCircle size={64} style={{ color: "var(--color-success)" }} />
                <div>
                  <h2 style={{ margin: 0, marginBottom: "var(--space-sm)" }}>
                    {t("auth.verification.verified") || "Email Verified!"}
                  </h2>
                  <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
                    {t("auth.verification.verifiedDescription") ||
                      "Your email has been successfully verified"}
                  </p>
                </div>
                <Button variant="primary" onClick={() => void navigate("/")}>
                  {t("common.continue") || "Continue"}
                </Button>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle size={64} style={{ color: "var(--color-danger)" }} />
                <div>
                  <h2 style={{ margin: 0, marginBottom: "var(--space-sm)" }}>
                    {t("auth.verification.error") || "Verification Failed"}
                  </h2>
                  <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
                    {error ||
                      t("auth.verification.errorDescription") ||
                      "The verification link is invalid or expired"}
                  </p>
                </div>
                <Button variant="primary" onClick={() => void navigate("/login")}>
                  {t("common.backToLogin") || "Back to Login"}
                </Button>
              </>
            )}

            {error && status !== "error" && (
              <Alert variant="danger" title={t("common.error") || "Error"}>
                {error}
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
