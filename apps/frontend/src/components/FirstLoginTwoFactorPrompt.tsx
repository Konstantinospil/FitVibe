import React, { useEffect, useState } from "react";
import { Button } from "@fitvibe/ui";
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
  const { isAuthenticated } = useAuth();
  const [stage, setStage] = useState<"checking" | "choice" | "setup" | "done">("checking");
  const [translationsReady, setTranslationsReady] = useState(false);

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
        if (status.enabled || status.invitationDismissed) {
          setStage("done");
          onResolved();
        } else {
          setStage("choice");
        }
      },
      () => {
        // Never block consent or the application because 2FA status is unavailable.
        if (active) {
          setStage("done");
          onResolved();
        }
      },
    );
    return () => {
      active = false;
    };
  }, [isAuthenticated, onResolved]);

  const complete = () => {
    setStage("done");
    onResolved();
  };

  const dismiss = async () => {
    try {
      await dismiss2FAInvitation();
      complete();
    } catch {
      // Do not claim a saved decision; retry is available on the next login.
      complete();
    }
  };

  return (
    <>
      <span hidden data-onboarding-2fa-stage={stage} />
      <Modal
        open={translationsReady && (stage === "choice" || stage === "setup")}
        title={t("firstLogin2fa.title")}
        description={t("firstLogin2fa.description")}
        onClose={() => void dismiss()}
        closeLabel={t("common.close")}
        closeOnBackdrop={false}
        footer={
          stage === "choice" ? (
            <>
              <Button type="button" variant="secondary" onClick={() => void dismiss()}>
                {t("firstLogin2fa.notNow")}
              </Button>
              <Button type="button" onClick={() => setStage("setup")}>
                {t("firstLogin2fa.activate")}
              </Button>
            </>
          ) : undefined
        }
      >
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
