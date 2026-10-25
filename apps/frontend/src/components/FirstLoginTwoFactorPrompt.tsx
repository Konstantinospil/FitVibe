import React, { useEffect, useState } from "react";
import { Button } from "@fitvibe/ui";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import i18n, {
  ensurePrivateTranslationsLoaded,
  loadLanguageTranslations,
  minimalTranslationsReady,
} from "../i18n/config";
import { dismiss2FAInvitation, get2FAStatus } from "../services/api";
import { Modal } from "./composites/Modal";
import { TwoFactorManagement } from "./profile/TwoFactorManagement";

interface Props {
  onResolved: () => void;
}

export const FirstLoginTwoFactorPrompt: React.FC<Props> = ({ onResolved }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const mandatory = user?.role === "admin" || user?.role === "superadmin";
  const [stage, setStage] = useState<"checking" | "choice" | "setup" | "done">("checking");
  const [translationsReady, setTranslationsReady] = useState(false);
  const [dismissError, setDismissError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await minimalTranslationsReady;
        await ensurePrivateTranslationsLoaded();
        const language = i18n.language?.slice(0, 2);
        if (
          language === "en" ||
          language === "de" ||
          language === "fr" ||
          language === "es" ||
          language === "el"
        ) {
          await loadLanguageTranslations(language);
        }
        if (active) {
          setTranslationsReady(true);
        }
      } catch {
        // Preserve the onboarding flow if translations cannot be loaded.
        if (active) {
          setTranslationsReady(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setStage("done");
      onResolved();
      return;
    }
    let active = true;
    setStage("checking");
    void get2FAStatus().then(
      (status) => {
        if (!active) {
          return;
        }
        if (status.enabled || (!mandatory && status.invitationDismissed)) {
          setStage("done");
          onResolved();
        } else {
          setStage("choice");
        }
      },
      () => {
        // Required administrator enrollment fails closed if status is unavailable.
        if (active) {
          setStage(mandatory ? "choice" : "done");
          if (!mandatory) onResolved();
        }
      },
    );
    return () => {
      active = false;
    };
  }, [isAuthenticated, mandatory, onResolved]);

  const complete = () => {
    if (mandatory) {
      // An enrollment-only admin session is never upgraded in-place. Re-login
      // with a verified second factor to obtain an MFA-attested session.
      void signOut().then(
        () => navigate("/login", { replace: true }),
        () => navigate("/login", { replace: true }),
      );
      return;
    }
    setStage("done");
    onResolved();
  };

  const dismiss = async () => {
    if (mandatory) return;
    setDismissError(false);
    try {
      await dismiss2FAInvitation();
      complete();
    } catch {
      // A failed persistence write must not be treated as a completed onboarding
      // decision. Keep the invitation open so the user can retry explicitly.
      setDismissError(true);
      setStage("choice");
    }
  };

  return (
    <>
      <span hidden data-onboarding-2fa-stage={stage} />
      <Modal
        open={translationsReady && (stage === "choice" || stage === "setup")}
        title={t("firstLogin2fa.title")}
        description={t("firstLogin2fa.description")}
        onClose={mandatory ? undefined : () => void dismiss()}
        closeLabel={t("common.close")}
        closeOnBackdrop={false}
        footer={
          stage === "choice" ? (
            <>
              {!mandatory ? (
                <Button type="button" variant="secondary" onClick={() => void dismiss()}>
                  {t("firstLogin2fa.notNow")}
                </Button>
              ) : null}
              <Button type="button" onClick={() => setStage("setup")}>
                {t("firstLogin2fa.activate")}
              </Button>
            </>
          ) : undefined
        }
      >
        {mandatory ? <p role="status">{t("firstLogin2fa.requiredAdmin")}</p> : null}
        {dismissError ? <p role="alert">{t("firstLogin2fa.dismissError")}</p> : null}
        {stage === "setup" ? (
          <TwoFactorManagement
            enabled={false}
            onBackupCodesFinished={complete}
            onStatusChanged={async () => {
              const status = await get2FAStatus();
              if (!status.enabled) {
                throw new Error("2FA verification did not persist");
              }
            }}
          />
        ) : null}
      </Modal>
    </>
  );
};
