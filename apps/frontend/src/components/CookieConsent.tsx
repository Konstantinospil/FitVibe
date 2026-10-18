import React, { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button, IconButton, Switch } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { useCookieConsent, type CookieConsentState } from "../hooks/useCookieConsent";
import "./CookieConsent.css";

export const REJECT_COOKIES: CookieConsentState = {
  essential: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export const ACCEPT_COOKIES: CookieConsentState = {
  essential: true,
  preferences: true,
  analytics: true,
  marketing: true,
};

const categories = ["essential", "preferences", "analytics", "marketing"] as const;
const LEGAL_ROUTES = new Set(["/terms", "/privacy", "/cookie"]);

export function CookiePreferences({ initial = false }: { initial?: boolean }) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const { consentStatus, isLoading, savePreferences } = useCookieConsent();
  const [draft, setDraft] = useState<CookieConsentState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const hasConsent = Boolean(consentStatus?.hasConsent);
  const current = consentStatus?.consent;

  const selected = draft ?? {
    essential: true,
    preferences: current?.preferences ?? false,
    analytics: current?.analytics ?? false,
    marketing: current?.marketing ?? false,
  };
  const hidden = isLoading || (initial && hasConsent);

  useEffect(() => {
    if (initial && !hidden) {
      dialogRef.current?.focus();
    }
  }, [initial, hidden]);

  const persist = async (choice: CookieConsentState) => {
    setSaving(true);
    setError(false);
    try {
      await savePreferences(choice);
      setDraft(null);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <div className={initial ? "cookie-consent-backdrop" : "cookie-preferences-inline"}>
      <section
        ref={dialogRef}
        tabIndex={initial ? -1 : undefined}
        className="cookie-consent-dialog"
        role={initial ? "dialog" : "region"}
        aria-modal={initial ? true : undefined}
        aria-labelledby={titleId}
      >
        <div className="cookie-consent-heading">
          <h2 id={titleId}>{t("cookie.title")}</h2>
          {initial ? (
            <IconButton
              label={t("cookie.actions.closeReject")}
              icon={<X aria-hidden="true" />}
              disabled={saving}
              onClick={() => void persist(REJECT_COOKIES)}
            />
          ) : null}
        </div>
        <p>{t("cookie.intro")}</p>
        <div className="cookie-consent-categories">
          {categories.map((key) => (
            <div key={key} className="cookie-consent-row">
              <div>
                <h3>{t(`cookie.categories.${key}.label`)}</h3>
                <p>{t(`cookie.categories.${key}.description`)}</p>
              </div>
              <Switch
                aria-label={t(`cookie.categories.${key}.label`)}
                checked={selected[key]}
                disabled={saving || key === "essential"}
                onChange={(event) => setDraft({ ...selected, [key]: event.target.checked })}
              />
            </div>
          ))}
        </div>
        {error ? <p role="alert">{t("cookie.actions.saveError")}</p> : null}
        <div className="cookie-consent-actions">
          <Button disabled={saving} onClick={() => void persist(REJECT_COOKIES)}>
            {t("cookie.actions.rejectAll")}
          </Button>
          <Button disabled={saving} onClick={() => void persist(ACCEPT_COOKIES)}>
            {t("cookie.actions.acceptAll")}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => void persist(selected)}>
            {t("cookie.actions.savePreferences")}
          </Button>
        </div>
        <a href="/cookie" target="_blank" rel="noopener noreferrer">
          {t("cookie.policy.link")}
        </a>
      </section>
    </div>
  );
}

export default function CookieConsent() {
  const { pathname } = useLocation();
  return LEGAL_ROUTES.has(pathname) ? null : <CookiePreferences initial />;
}
