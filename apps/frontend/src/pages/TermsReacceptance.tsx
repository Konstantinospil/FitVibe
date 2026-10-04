import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthPageLayout from "../components/AuthPageLayout";
import { Button, Checkbox, TextLink } from "@fitvibe/ui";
import { FormActions, FormFeedback, FormStack } from "../components/composites/FormStack";
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
      <FormStack
        ref={formRef}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <FormFeedback tone="warning">{t("auth.termsReacceptance.notice")}</FormFeedback>

        <Checkbox
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          required
          disabled={isSubmitting}
          error={error && !acceptedTerms ? t("auth.termsReacceptance.termsRequired") : undefined}
          aria-required="true"
          label={
            <span>
              {t("auth.termsReacceptance.acceptTerms")}{" "}
              <TextLink
                as={NavLink}
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t("auth.termsReacceptance.termsLink")}
              </TextLink>{" "}
              {t("auth.termsReacceptance.and")}{" "}
              <TextLink
                as={NavLink}
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t("auth.termsReacceptance.privacyLink")}
              </TextLink>
            </span>
          }
        />

        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}

        <FormActions>
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
        </FormActions>
      </FormStack>
    </AuthPageLayout>
  );
};

export default TermsReacceptance;
