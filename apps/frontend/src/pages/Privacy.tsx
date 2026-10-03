import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PublishedLegalDocument from "../components/PublishedLegalDocument";
import { Button } from "@fitvibe/ui";
import { useAuthStore } from "../store/auth.store";
import { useToast } from "../contexts/ToastContext";
import {
  acceptPrivacyPolicy,
  getLegalDocumentsStatus,
  revokePrivacyPolicy,
  type LegalDocumentsStatus,
} from "../services/api";

const Privacy: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [status, setStatus] = useState<LegalDocumentsStatus["privacy"] | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void getLegalDocumentsStatus()
      .then((result) => {
        if (!cancelled) {
          setStatus(result.privacy);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleAcknowledge = async () => {
    setIsWorking(true);
    try {
      await acceptPrivacyPolicy({ privacy_policy_accepted: true });
      const next = await getLegalDocumentsStatus();
      setStatus(next.privacy);
    } catch {
      toast.error(
        t("privacy.consent.acceptError", { defaultValue: "Could not save acknowledgement." }),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleRevoke = async () => {
    setIsWorking(true);
    try {
      await revokePrivacyPolicy();
      const next = await getLegalDocumentsStatus();
      setStatus(next.privacy);
    } catch {
      toast.error(
        t("privacy.consent.revokeError", { defaultValue: "Could not revoke acknowledgement." }),
      );
    } finally {
      setIsWorking(false);
    }
  };

  const footerAction =
    isAuthenticated && status?.needsAcceptance ? (
      <Button variant="primary" onClick={() => void handleAcknowledge()} isLoading={isWorking}>
        {t("privacy.consent.acknowledge", { defaultValue: "Acknowledge" })}
      </Button>
    ) : isAuthenticated && status && !status.needsAcceptance && status.acceptedVersion ? (
      <Button variant="danger" onClick={() => void handleRevoke()} isLoading={isWorking}>
        {t("privacy.consent.revoke", { defaultValue: "Revoke acknowledgement" })}
      </Button>
    ) : undefined;

  return (
    <PublishedLegalDocument
      documentType="privacy"
      title={t("privacy.title")}
      footerAction={footerAction}
    />
  );
};

export default Privacy;
