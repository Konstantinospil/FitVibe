import React, { useEffect, useState } from "react";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { get2FAStatus } from "../services/api";
import { Modal } from "./composites/Modal";
import { TwoFactorManagement } from "./profile/TwoFactorManagement";

export const firstLoginTwoFactorKey = (userId: string) =>
  `fitvibe:two-factor-invitation:v1:${userId}`;

interface Props {
  onResolved: () => void;
}

export const FirstLoginTwoFactorPrompt: React.FC<Props> = ({ onResolved }) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [stage, setStage] = useState<"checking" | "choice" | "setup" | "done">("checking");
  const userId = user?.id;

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setStage("done");
      onResolved();
      return;
    }
    if (localStorage.getItem(firstLoginTwoFactorKey(userId)) === "done") {
      setStage("done");
      onResolved();
      return;
    }
    let active = true;
    setStage("checking");
    void get2FAStatus().then(
      (status) => {
        if (!active) return;
        if (status.enabled) {
          localStorage.setItem(firstLoginTwoFactorKey(userId), "done");
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
    return () => { active = false; };
  }, [isAuthenticated, userId, onResolved]);

  const finish = () => {
    if (userId) localStorage.setItem(firstLoginTwoFactorKey(userId), "done");
    setStage("done");
    onResolved();
  };

  return (
    <Modal
      open={stage === "choice" || stage === "setup"}
      title={t("firstLogin2fa.title")}
      description={t("firstLogin2fa.description")}
      onClose={finish}
      closeLabel={t("firstLogin2fa.notNow")}
      closeOnBackdrop={false}
      footer={stage === "choice" ? (
        <>
          <Button type="button" variant="secondary" onClick={finish}>{t("firstLogin2fa.notNow")}</Button>
          <Button type="button" onClick={() => setStage("setup")}>{t("firstLogin2fa.activate")}</Button>
        </>
      ) : undefined}
    >
      {stage === "setup" ? (
        <TwoFactorManagement
          enabled={false}
          onStatusChanged={async () => {
            const status = await get2FAStatus();
            if (status.enabled) finish();
          }}
        />
      ) : null}
    </Modal>
  );
};
