import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button } from "../components/ui";
import { acceptTerms } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { NavLink } from "react-router-dom";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";

const TermsReacceptance: React.FC = () => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError(t("auth.termsReacceptance.termsRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptTerms({ terms_accepted: true });
      // Refresh the page to get new tokens
      window.location.reload();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        };
        const errorCode = axiosError.response?.data?.error?.code;
        setError(errorCode ? t(`errors.${errorCode}`) : t("auth.termsReacceptance.error"));
      } else {
        setError(t("auth.termsReacceptance.error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    void navigate("/login", { replace: true });
  };

  return (
    <AuthPageLayout
      title={t("auth.termsReacceptance.title")}
      description={t("auth.termsReacceptance.description")}
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="form"
      >
        <div
          className="p-md rounded-md mb-1"
          style={{
            background: "var(--surface-warning-subtle)",
            border: "1px solid var(--border-warning-subtle)",
          }}
        >
          <p className="m-0 text-secondary text-095">{t("auth.termsReacceptance.notice")}</p>
        </div>

        <label
          className="checkbox-wrapper"
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            background: "var(--color-surface-glass)",
            border:
              error && !acceptedTerms
                ? "1px solid var(--color-danger)"
                : "1px solid var(--color-border)",
            transition: "border-color 150ms ease",
          }}
        >
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            required
            disabled={isSubmitting}
            style={{
              marginTop: "0.2rem",
              cursor: "pointer",
              width: "18px",
              height: "18px",
              accentColor: "var(--color-accent)",
            }}
            aria-required="true"
            aria-invalid={error && !acceptedTerms ? "true" : "false"}
          />
          <span className="checkbox-label">
            {t("auth.termsReacceptance.acceptTerms")}{" "}
            <NavLink
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.termsReacceptance.termsLink")}
            </NavLink>{" "}
            {t("auth.termsReacceptance.and")}{" "}
            <NavLink
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {t("auth.termsReacceptance.privacyLink")}
            </NavLink>
          </span>
        </label>

        {error ? (
          <div role="alert" className="form-error">
            {error}
          </div>
        ) : null}

        <div className="flex flex--gap-md flex--wrap">
          <Button
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            disabled={isSubmitting || !acceptedTerms}
          >
            {isSubmitting
              ? t("auth.termsReacceptance.submitting")
              : t("auth.termsReacceptance.submit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => {
              void handleSignOut();
            }}
            disabled={isSubmitting}
          >
            {t("auth.termsReacceptance.signOut")}
          </Button>
        </div>
      </form>
    </AuthPageLayout>
  );
};

export default TermsReacceptance;
