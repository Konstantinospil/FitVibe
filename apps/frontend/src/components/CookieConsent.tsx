import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Switch } from "@fitvibe/ui";
import { useCookieConsent, type CookieConsentState } from "../hooks/useCookieConsent";

const initial: CookieConsentState = {
  essential: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export default function CookieConsent() {
  const { t } = useTranslation();
  const { consentStatus, isLoading, savePreferences } = useCookieConsent();
  const [preferences, setPreferences] = useState<CookieConsentState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  if (isLoading || consentStatus?.hasConsent) return null;

  const persist = async (choice: CookieConsentState) => {
    setSaving(true);
    setError(false);
    try {
      await savePreferences({ ...choice, essential: true });
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  const categories = (["essential", "preferences", "analytics", "marketing"] as const);
  return (
    <div className="cookie-consent-backdrop">
      <section className="cookie-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-intro">
        <h2 id="cookie-consent-title">{t("cookie.title", { defaultValue: "Cookie preferences" })}</h2>
        <p id="cookie-consent-intro">{t("cookie.intro", { defaultValue: "Choose which optional cookies FitVibe may use. Essential cookies are always enabled." })}</p>
        <div className="cookie-consent-categories">
          {categories.map(category => (
            <div className="cookie-consent-row" key={category}>
              <div>
                <h3>{t(`cookie.categories.${category}.label`, { defaultValue: category })}</h3>
                <p>{t(`cookie.categories.${category}.description`, { defaultValue: "" })}</p>
              </div>
              <Switch
                aria-label={t(`cookie.categories.${category}.label`, { defaultValue: category })}
                checked={preferences[category]}
                disabled={saving || category === "essential"}
                onChange={event => setPreferences(previous => ({ ...previous, [category]: event.target.checked }))}
              />
            </div>
          ))}
        </div>
        {error && <p role="alert">{t("cookie.actions.saveError", { defaultValue: "Could not save cookie preferences. Please try again." })}</p>}
        <div className="cookie-consent-actions">
          <Button disabled={saving} variant="secondary" onClick={() => void persist(initial)}>{t("cookie.actions.rejectAll", { defaultValue: "Reject optional" })}</Button>
          <Button disabled={saving} variant="secondary" onClick={() => void persist(preferences)}>{t("cookie.actions.save", { defaultValue: "Save selection" })}</Button>
          <Button disabled={saving} onClick={() => void persist({ essential: true, preferences: true, analytics: true, marketing: true })}>{t("cookie.actions.acceptAll", { defaultValue: "Accept all" })}</Button>
        </div>
      </section>
    </div>
  );
}
