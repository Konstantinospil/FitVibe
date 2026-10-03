import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { loadLanguageTranslations } from "../../i18n/config";
import {
  getUserPreferences,
  updateUserPreferences,
  type UserPreferences,
} from "../../services/api";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";
import { useToast } from "../ui/Toast";

export interface PreferencesSettingsProps {
  onUpdate?: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: "en",
  measurementSystem: "metric",
};

export const PreferencesSettings: React.FC<PreferencesSettingsProps> = ({ onUpdate }) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      setError(null);
      try {
        setPreferences(await getUserPreferences());
      } catch {
        setError(t("settings.preferences.loadError") || "Failed to load preferences");
      } finally {
        setIsLoading(false);
      }
    };

    void loadPreferences();
  }, [t]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const saved = await updateUserPreferences(preferences);
      setPreferences(saved);
      await loadLanguageTranslations(saved.language);
      await i18n.changeLanguage(saved.language);
      showToast({
        variant: "success",
        title: t("settings.preferences.saveSuccess") || "Preferences saved",
      });
      onUpdate?.();
    } catch {
      setError(t("settings.preferences.saveError") || "Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const languageOptions = [
    { value: "en", label: t("language.english") || "English" },
    { value: "de", label: t("language.german") || "German" },
    { value: "fr", label: t("language.french") || "French" },
    { value: "es", label: t("language.spanish") || "Spanish" },
    { value: "el", label: t("language.greek") || "Greek" },
  ];

  const measurementOptions = [
    { value: "metric", label: t("settings.preferences.unitsMetric") || "Metric (kg, km)" },
    { value: "imperial", label: t("settings.preferences.unitsImperial") || "Imperial (lb, mi)" },
  ];

  if (isLoading) {
    return (
      <Card data-testid="preferences-settings-loading">
        <CardContent>
          <div style={{ padding: "var(--space-xl)", textAlign: "center" }}>
            <Spinner label={t("common.loading") || "Loading"} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="preferences-settings">
      <CardHeader>
        <CardTitle>{t("settings.preferences.title") || "Preferences"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-lg">
          {error && <Alert variant="danger">{error}</Alert>}

          <Alert variant="info">
            {t("settings.preferences.description") ||
              "Choose your preferred language and measurement system"}
          </Alert>

          <Select
            label={t("settings.preferences.language") || "Language"}
            options={languageOptions}
            value={preferences.language}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                language: event.target.value as UserPreferences["language"],
              })
            }
          />

          <Select
            label={t("settings.preferences.units") || "Units"}
            options={measurementOptions}
            value={preferences.measurementSystem}
            onChange={(event) =>
              setPreferences({
                ...preferences,
                measurementSystem: event.target.value as UserPreferences["measurementSystem"],
              })
            }
          />

          <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              onClick={() => {
                void handleSave();
              }}
              isLoading={isSaving}
            >
              {t("settings.preferences.saveButton") || "Save Preferences"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
