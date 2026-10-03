import React from "react";
import { useTranslation } from "react-i18next";
import PageIntro from "../components/PageIntro";
import PublicReturnButton from "../components/PublicReturnButton";
import PublishedLegalDocument from "../components/PublishedLegalDocument";
import { Card, CardContent, Button } from "../components/ui";
import { useCookieConsent } from "../hooks/useCookieConsent";
import { useToast } from "../contexts/ToastContext";

const Cookie: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { consentStatus, savePreferences, isLoading } = useCookieConsent();

  const revokeOptionalConsent = async () => {
    try {
      await savePreferences({
        essential: true,
        preferences: false,
        analytics: false,
        marketing: false,
      });
      toast.success(
        t("cookie.revokeSuccess", {
          defaultValue: "Optional cookie consent has been withdrawn.",
        }),
      );
    } catch {
      toast.error(t("cookie.revokeError"));
    }
  };

  return (
    <PageIntro
      title={t("cookie.policy.title")}
      description={t("cookie.policy.description")}
      actions={<PublicReturnButton />}
    >
      <Card style={{ maxWidth: "900px", width: "100%", margin: "0 auto" }}>
        <CardContent style={{ padding: "2rem", lineHeight: 1.8 }}>
          <PublishedLegalDocument documentType="cookie" />

          {consentStatus?.hasConsent && !isLoading ? (
            <div className="flex flex--center mt-xl">
              <Button variant="secondary" onClick={() => void revokeOptionalConsent()}>
                {t("cookie.revokeConsent", { defaultValue: "Withdraw optional cookie consent" })}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageIntro>
  );
};

export default Cookie;
