import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, InputControl } from "@fitvibe/ui";
import {
  disable2FA,
  regenerate2FABackupCodes,
  setup2FA,
  verify2FA,
  type TwoFactorSetupResponse,
} from "../../services/api";

type Action = "disable" | "regenerate";

interface Props {
  enabled: boolean;
  onStatusChanged: () => Promise<unknown>;
}

export const TwoFactorManagement: React.FC<Props> = ({ enabled, onStatusChanged }) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealCodes, setRevealCodes] = useState(false);

  const clearSensitiveState = () => {
    setSetup(null);
    setBackupCodes([]);
    setCode("");
    setPassword("");
    setAction(null);
    setRevealCodes(false);
    setError(null);
  };

  const beginSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await setup2FA();
      setSetup(result);
      setBackupCodes(result.backupCodes);
    } catch {
      setError(t("settings.security.enableError"));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verify2FA(code);
      if (!result.success) throw new Error("Verification failed");
      setSetup(null);
      setCode("");
      await onStatusChanged();
    } catch {
      setError(t("settings.security.verifyError"));
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async () => {
    if (!action || !password || !code) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "disable") {
        await disable2FA({ password, code });
        clearSensitiveState();
        await onStatusChanged();
      } else {
        const result = await regenerate2FABackupCodes({ password, code });
        clearSensitiveState();
        setBackupCodes(result.backupCodes);
      }
    } catch {
      setError(t("settings.security.disableError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <strong>{enabled ? t("settings.security.enabled") : t("settings.security.disabled")}</strong>
      <p>{enabled ? t("settings.security.enabledHelp") : t("settings.security.disabledHelp")}</p>
      {error && <p role="alert">{error}</p>}

      {!enabled && !setup && (
        <Button type="button" disabled={busy} isLoading={busy} onClick={() => void beginSetup()}>
          {t("settings.security.enable")}
        </Button>
      )}

      {!enabled && setup && (
        <>
          <p>{t("settings.security.scanQr")}</p>
          {setup.qrCode.startsWith("data:image/png;base64,") && (
            <img src={setup.qrCode} alt={t("settings.security.qrAlt")} />
          )}
          <p>{setup.secret}</p>
          <label className="form-label">
            <span className="form-label-text">{t("settings.security.enterCode")}</span>
            <InputControl
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <Button type="button" disabled={busy || !/^\d{6}$/.test(code)}
            isLoading={busy} onClick={() => void confirmSetup()}>
            {t("settings.security.verifyEnable")}
          </Button>
          <Button type="button" disabled={busy} onClick={clearSensitiveState}>
            {t("common.cancel")}
          </Button>
        </>
      )}

      {enabled && !action && backupCodes.length === 0 && (
        <>
          <Button type="button" onClick={() => setAction("regenerate")}>
            {t("settings.security.backupCodes")}
          </Button>
          <Button type="button" onClick={() => setAction("disable")}>
            {t("settings.security.disable")}
          </Button>
        </>
      )}

      {action && (
        <>
          <label className="form-label">
            <span className="form-label-text">{t("settings.security.disablePasswordLabel")}</span>
            <InputControl type="password" autoComplete="current-password" value={password}
              onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="form-label">
            <span className="form-label-text">{t("settings.security.enterCode")}</span>
            <InputControl value={code} autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value.trim().toUpperCase())} />
          </label>
          <Button type="button" disabled={busy || !password || !code} isLoading={busy}
            onClick={() => void confirmAction()}>
            {action === "disable" ? t("settings.security.confirmDisable") : t("settings.security.backupCodes")}
          </Button>
          <Button type="button" disabled={busy} onClick={clearSensitiveState}>
            {t("common.cancel")}
          </Button>
        </>
      )}

      {backupCodes.length > 0 && (
        <div>
          <p>{t("settings.security.backupCodesHelp")}</p>
          <Button type="button" onClick={() => setRevealCodes((current) => !current)}>
            {revealCodes ? t("common.hide") : t("common.show")}
          </Button>
          {revealCodes && <ul>{backupCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>}
          <Button type="button" onClick={clearSensitiveState}>{t("common.done")}</Button>
        </div>
      )}
    </div>
  );
};
