import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ModalFooter } from "./ui/Modal";
import { Button } from "./ui/Button";
import { useCookieConsent } from "../hooks/useCookieConsent";
import { useToast } from "../contexts/ToastContext";

interface CookieCategory {
  id: "essential" | "preferences" | "analytics" | "marketing";
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
}

const CookieConsent: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { consentStatus, isLoading, savePreferences } = useCookieConsent();
  const [isOpen, setIsOpen] = useState(false);
  const [categoryStates, setCategoryStates] = useState<{
    essential: boolean;
    preferences: boolean;
    analytics: boolean;
    marketing: boolean;
  }>({
    essential: true,
    preferences: false,
    analytics: false,
    marketing: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Create categories array with translations that update when language changes
  const categories: CookieCategory[] = [
    {
      id: "essential",
      label: t("cookie.categories.essential.label"),
      description: t("cookie.categories.essential.description"),
      enabled: categoryStates.essential,
      disabled: true, // Always enabled, cannot be changed
    },
    {
      id: "preferences",
      label: t("cookie.categories.preferences.label"),
      description: t("cookie.categories.preferences.description"),
      enabled: categoryStates.preferences,
      disabled: false,
    },
    {
      id: "analytics",
      label: t("cookie.categories.analytics.label"),
      description: t("cookie.categories.analytics.description"),
      enabled: categoryStates.analytics,
      disabled: false,
    },
    {
      id: "marketing",
      label: t("cookie.categories.marketing.label"),
      description: t("cookie.categories.marketing.description"),
      enabled: categoryStates.marketing,
      disabled: false,
    },
  ];

  // Check if banner should be shown
  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Show banner if no consent exists from API
    // The localStorage flag is just an optimization - if API says no consent, show banner regardless
    const hasNoConsent = !consentStatus?.hasConsent || !consentStatus?.consent;
    const shouldShow = hasNoConsent;
    setIsOpen(shouldShow);

    // If consent exists, update category states from API
    if (consentStatus?.consent) {
      setCategoryStates({
        essential: consentStatus.consent.essential,
        preferences: consentStatus.consent.preferences,
        analytics: consentStatus.consent.analytics,
        marketing: consentStatus.consent.marketing,
      });
    }
  }, [consentStatus, isLoading]);

  const handleToggle = (id: CookieCategory["id"]) => {
    // Essential cookies cannot be toggled
    if (id === "essential") {
      return;
    }

    setCategoryStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAcceptAll = () => {
    setCategoryStates({
      essential: true,
      preferences: true,
      analytics: true,
      marketing: true,
    });
  };

  const handleRejectAll = () => {
    setCategoryStates({
      essential: true, // Always true
      preferences: false,
      analytics: false,
      marketing: false,
    });
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await savePreferences({
        essential: categoryStates.essential,
        preferences: categoryStates.preferences,
        analytics: categoryStates.analytics,
        marketing: categoryStates.marketing,
      });
      setIsOpen(false);
    } catch {
      toast.error(t("cookie.actions.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  // Don't render if loading or not open
  if (isLoading || !isOpen) {
    return null;
  }

  const toggleStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    width: "44px",
    height: "24px",
  };

  const toggleInputStyle: React.CSSProperties = {
    opacity: "var(--opacity-disabled)",
    width: 0,
    height: 0,
  };

  const toggleSliderStyle = (enabled: boolean, disabled: boolean): React.CSSProperties => ({
    position: "absolute",
    cursor: disabled ? "not-allowed" : "pointer",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: enabled ? "var(--color-primary)" : "var(--color-surface-muted)",
    transition: "0.3s",
    borderRadius: "var(--radius-full)",
    opacity: disabled ? 0.5 : 1,
  });

  const toggleSliderBeforeStyle = (enabled: boolean): React.CSSProperties => ({
    position: "absolute",
    content: '""',
    height: "18px",
    width: "18px",
    left: enabled ? "22px" : "3px",
    bottom: "3px",
    backgroundColor: "var(--color-surface)",
    transition: "0.3s",
    borderRadius: "var(--radius-full)",
    boxShadow: "var(--shadow-e1)",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // Prevent closing without selection - GDPR requirement
        // Modal cannot be dismissed without making a choice
      }}
      title={t("cookie.title")}
      description={t("cookie.description")}
      size="lg"
      closeOnOverlayClick={false}
      closeOnEscape={false}
      showCloseButton={false}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          {t("cookie.intro")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {categories.map((category) => (
            <div
              key={category.id}
              style={{
                padding: "var(--space-md)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "var(--space-md)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      marginBottom: "var(--space-xs)",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "var(--font-size-md)",
                        fontWeight: "var(--font-weight-semibold)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {category.label}
                    </h3>
                    {category.disabled && (
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--color-text-muted)",
                          padding: "0.125rem var(--space-xs)",
                          backgroundColor: "var(--color-surface-muted)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        {t("cookie.required")}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {category.description}
                  </p>
                </div>
                <label style={toggleStyle}>
                  <input
                    type="checkbox"
                    checked={category.enabled}
                    disabled={category.disabled}
                    onChange={() => handleToggle(category.id)}
                    style={toggleInputStyle}
                    aria-label={`${category.label} ${category.enabled ? t("cookie.enabled") : t("cookie.disabled")}`}
                  />
                  <span style={toggleSliderStyle(category.enabled, category.disabled)}>
                    <span style={toggleSliderBeforeStyle(category.enabled)} />
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "var(--space-md)",
            backgroundColor: "var(--color-surface-muted)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <p style={{ margin: 0, marginBottom: "var(--space-xs)" }}>
            <strong>{t("cookie.policy.title")}</strong>
          </p>
          <p style={{ margin: 0 }}>
            {t("cookie.policy.description")}{" "}
            <a
              href="/cookie"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-primary)",
                textDecoration: "underline",
              }}
            >
              {t("cookie.policy.link")}
            </a>
          </p>
        </div>
      </div>

      <ModalFooter>
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            flexWrap: "wrap",
            width: "100%",
            justifyContent: "flex-end",
          }}
        >
          <Button variant="secondary" onClick={handleRejectAll} disabled={isSaving}>
            {t("cookie.actions.rejectAll")}
          </Button>
          <Button variant="secondary" onClick={handleAcceptAll} disabled={isSaving}>
            {t("cookie.actions.acceptAll")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void handleSavePreferences();
            }}
            isLoading={isSaving}
          >
            {t("cookie.actions.savePreferences")}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default CookieConsent;
