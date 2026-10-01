import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import PublishedLegalDocument from "../components/PublishedLegalDocument";
import { Button } from "@fitvibe/ui";
import { useAuthStore } from "../store/auth.store";
import { useToast } from "../contexts/ToastContext";
import {
  acceptTerms,
  getLegalDocumentsStatus,
  revokeTerms,
  type LegalDocumentsStatus,
} from "../services/api";

const Terms: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const signOut = useAuthStore((state) => state.signOut);
  const [status, setStatus] = useState<LegalDocumentsStatus["terms"] | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
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
          setStatus(result.terms);
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

  const handleAccept = async () => {
    setIsWorking(true);
    try {
      await acceptTerms({ terms_accepted: true });
      const next = await getLegalDocumentsStatus();
      setStatus(next.terms);
      void navigate("/", { replace: true });
    } catch {
      toast.error(t("terms.consent.acceptError"));
    } finally {
      setIsWorking(false);
    }
  };

  const handleRevoke = async () => {
    setIsWorking(true);
    try {
      await revokeTerms();
      await signOut();
      void navigate("/login", { replace: true });
    } catch {
      toast.error(t("terms.consent.revokeError"));
      setShowRevokeConfirm(false);
    } finally {
      setIsWorking(false);
    }
  };

  const footerAction =
    isAuthenticated && status?.needsAcceptance ? (
      <Button variant="primary" onClick={() => void handleAccept()} isLoading={isWorking}>
        {isWorking ? t("terms.consent.accepting") : t("terms.consent.accept")}
      </Button>
    ) : isAuthenticated && status && !status.needsAcceptance ? (
      <Button variant="danger" onClick={() => setShowRevokeConfirm(true)} disabled={isWorking}>
        {t("terms.consent.revoke")}
      </Button>
    ) : undefined;

  return (
    <>
      <PublishedLegalDocument
        documentType="terms"
        title={t("terms.title")}
        footerAction={footerAction}
      />

      <ConfirmDialog
        isOpen={showRevokeConfirm}
        title={t("terms.consent.revokeConfirm.title")}
        message={t("terms.consent.revokeConfirm.message")}
        confirmLabel={t("terms.consent.revokeConfirm.confirm")}
        cancelLabel={t("terms.consent.revokeConfirm.cancel")}
        variant="warning"
        onConfirm={() => void handleRevoke()}
        onCancel={() => setShowRevokeConfirm(false)}
      />
    </>
  );
};

export default Terms;
