import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageIntro from "../components/PageIntro";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { rawHttpClient, resendVerificationEmail } from "../services/api";
import { useCountdown } from "../hooks/useCountdown";

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "expired">("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendEmail, setResendEmail] = useState<string>("");
  const [resendError, setResendError] = useState<string>("");
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [countdown, , resetCountdown] = useCountdown(0);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage(t("verifyEmail.noToken"));
      return;
    }

    const verifyEmail = async () => {
      try {
        await rawHttpClient.get(`/api/v1/auth/verify?token=${token}`);
        setStatus("success");
        // Redirect to login after 3 seconds
        setTimeout(() => {
          void navigate("/login");
        }, 3000);
      } catch (error: unknown) {
        if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as {
            response?: { status?: number; data?: { error?: { code?: string; message?: string } } };
          };
          const statusCode = axiosError.response?.status;
          const errorCode = axiosError.response?.data?.error?.code;

          // Check for 410 Gone (expired token)
          if (statusCode === 410 || errorCode === "AUTH_TOKEN_EXPIRED") {
            setStatus("expired");
            setErrorMessage(
              axiosError.response?.data?.error?.message || t("errors.AUTH_TOKEN_EXPIRED"),
            );
          } else {
            setStatus("error");
            setErrorMessage(axiosError.response?.data?.error?.message || "Verification failed");
          }
        } else {
          setStatus("error");
          setErrorMessage("Verification failed");
        }
      }
    };

    void verifyEmail();
  }, [searchParams, navigate, t]);

  return (
    <PageIntro
      eyebrow={t("verifyEmail.eyebrow")}
      title={
        status === "verifying"
          ? t("verifyEmail.titleVerifying")
          : status === "success"
            ? t("verifyEmail.titleSuccess")
            : status === "expired"
              ? t("verifyEmail.titleExpired")
              : t("verifyEmail.titleFailed")
      }
      description={
        status === "verifying"
          ? t("verifyEmail.descVerifying")
          : status === "success"
            ? t("verifyEmail.descSuccess")
            : status === "expired"
              ? t("verifyEmail.descExpired")
              : errorMessage || t("verifyEmail.descFailed")
      }
    >
      {status === "verifying" && (
        <div className="text-center p-2rem">
          <div
            className="rounded-full"
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid var(--surface-focus-subtle)",
              borderTopColor: "var(--color-focus)",
              margin: "0 auto",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {status === "success" && (
        <div className="text-center p-2rem">
          <div
            className="flex flex--center mb-1 rounded-full"
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 1rem",
              backgroundColor: "var(--surface-success-subtle)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <Button onClick={() => void navigate("/login")} className="mt-1">
            {t("verifyEmail.goToLogin")}
          </Button>
        </div>
      )}

      {status === "expired" && (
        <div className="text-center p-2rem">
          <div
            className="flex flex--center mb-1 rounded-full"
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 1rem",
              backgroundColor: "var(--surface-danger-subtle)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>

          {resendSuccess ? (
            <div className="mb-1">
              <p style={{ color: "var(--color-success)", marginBottom: "1rem" }}>
                {t("verifyEmail.resendSuccess")}
              </p>
              <Button onClick={() => void navigate("/login")} className="mt-1">
                {t("verifyEmail.goToLogin")}
              </Button>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                // Clear any previous errors
                setResendError("");

                // Check our custom validation
                if (!resendEmail.trim()) {
                  setResendError(t("auth.register.fillAllFields"));
                  return;
                }

                void (async () => {
                  setIsResending(true);
                  setResendError("");
                  setResendSuccess(false);

                  try {
                    await resendVerificationEmail({ email: resendEmail.trim() });
                    // Navigate to register page with trimmed email for user to complete registration
                    void navigate("/register", {
                      state: { email: resendEmail.trim(), resendVerification: true },
                    });
                  } catch (err: unknown) {
                    setResendSuccess(false);
                    if (err && typeof err === "object" && "response" in err) {
                      const axiosError = err as {
                        response?: {
                          data?: {
                            error?: { code?: string; message?: string; retryAfter?: number };
                          };
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

                      const errorMsg =
                        (errorCode
                          ? t(`errors.${errorCode}`) ||
                            axiosError.response?.data?.error?.message ||
                            t("verifyEmail.resendError")
                          : t("verifyEmail.resendError")) ?? "";
                      setResendError(errorMsg);
                    } else {
                      setResendError(t("verifyEmail.resendError"));
                    }
                  } finally {
                    setIsResending(false);
                  }
                })();
              }}
              style={{ maxWidth: "400px", margin: "0 auto" }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="resend-email"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "var(--font-weight-regular)",
                    textAlign: "left",
                  }}
                >
                  {t("verifyEmail.resendEmailLabel")}
                </label>
                <InputControl
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder={t("verifyEmail.resendEmailPlaceholder")}
                  required
                  disabled={isResending}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--type-body-size)",
                  }}
                />
              </div>
              {resendError && (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      color: "var(--color-danger)",
                      fontSize: "var(--type-supporting-size)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {resendError}
                  </p>
                  {retryAfter !== null && countdown > 0 && (
                    <p
                      style={{
                        color: "var(--color-text-muted)",
                        fontSize: "var(--type-supporting-size)",
                      }}
                    >
                      {t("verifyEmail.retryAfter", { seconds: countdown })}
                    </p>
                  )}
                </div>
              )}
              <Button
                type="submit"
                disabled={isResending}
                className="mt-1"
                style={{ width: "100%" }}
              >
                {isResending ? t("verifyEmail.resending") : t("verifyEmail.resendButton")}
              </Button>
              <Button
                type="button"
                onClick={() => void navigate("/register")}
                className="mt-1"
                style={{
                  width: "100%",
                  backgroundColor: "transparent",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("verifyEmail.backToRegister")}
              </Button>
            </form>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="text-center p-2rem">
          <div
            className="flex flex--center mb-1 rounded-full"
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 1rem",
              backgroundColor: "var(--surface-danger-subtle)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-danger)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <Button onClick={() => void navigate("/register")} className="mt-1">
            {t("verifyEmail.backToRegister")}
          </Button>
        </div>
      )}
    </PageIntro>
  );
};

export default VerifyEmail;
