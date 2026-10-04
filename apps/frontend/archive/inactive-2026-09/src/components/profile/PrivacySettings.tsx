import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";
import { Switch } from "../ui/Switch";
import { Alert } from "../ui/Alert";
import {
  getPrivacySettings,
  updatePrivacySettings,
  type PrivacySettings as PrivacySettingsData,
} from "../../services/api";
import { useToast } from "../ui/Toast";

export interface PrivacySettingsProps {
  onUpdate?: () => void;
}

/**
 * PrivacySettings component for managing privacy preferences.
 * Handles default visibility, follower settings, and profile field visibility.
 */
export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onUpdate }) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrivacySettingsData>({
    defaultVisibility: "private",
    allowFollowers: true,
    showEmail: false,
    showWeight: false,
    showFitnessLevel: false,
  });

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const data = await getPrivacySettings();
        setSettings(data);
      } catch {
        setError(t("settings.privacy.loadError") || "Failed to load privacy settings");
      } finally {
        setIsLoading(false);
      }
    };
    void loadSettings();
  }, [t]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await updatePrivacySettings(settings);
      showToast({
        variant: "success",
        title: t("settings.privacy.saved") || "Privacy Settings Updated",
        message: t("settings.privacy.savedMessage") || "Your privacy settings have been updated",
      });
      onUpdate?.();
    } catch {
      setError(t("settings.privacy.saveError") || "Failed to save privacy settings");
    } finally {
      setIsSaving(false);
    }
  };

  const visibilityOptions = [
    { value: "private", label: t("visibility.labels.private") || "Private" },
    { value: "followers", label: t("visibility.labels.followers") || "Followers Only" },
    { value: "link", label: t("visibility.labels.link") || "Link Only" },
    { value: "public", label: t("visibility.labels.public") || "Public" },
  ];

  if (isLoading) {
    return (
      <Card data-testid="privacy-settings-loading">
        <CardContent>
          <div style={{ padding: "var(--space-xl)", textAlign: "center" }}>
            <Spinner label={t("common.loading") || "Loading"} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="privacy-settings">
      <CardHeader>
        <CardTitle>{t("settings.privacy.title") || "Privacy Settings"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-lg">
          {error && <Alert variant="danger">{error}</Alert>}

          <Alert variant="info">
            {t("settings.privacy.description") ||
              "Control who can see your content and profile information"}
          </Alert>

          <Select
            label={t("settings.privacy.defaultVisibility") || "Default Visibility"}
            options={visibilityOptions}
            value={settings.defaultVisibility}
            onChange={(e) =>
              setSettings({
                ...settings,
                defaultVisibility: e.target.value as PrivacySettingsData["defaultVisibility"],
              })
            }
            helperText={
              t("settings.privacy.defaultVisibilityHelper") ||
              "This will be the default visibility for new sessions"
            }
          />

          <Switch
            label={t("settings.privacy.allowFollowers") || "Allow Followers"}
            checked={settings.allowFollowers}
            onChange={(e) => setSettings({ ...settings, allowFollowers: e.target.checked })}
            helperText={
              t("settings.privacy.allowFollowersHelper") || "Allow other users to follow you"
            }
          />

          <div
            style={{
              height: "1px",
              background: "var(--color-border)",
              margin: "var(--space-md) 0",
            }}
          />

          <h3
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              marginBottom: "var(--space-sm)",
            }}
          >
            {t("settings.privacy.profileVisibility") || "Profile Field Visibility"}
          </h3>

          <Switch
            label={t("settings.privacy.showEmail") || "Show Email Address"}
            checked={settings.showEmail}
            onChange={(e) => setSettings({ ...settings, showEmail: e.target.checked })}
            helperText={
              t("settings.privacy.showEmailHelper") ||
              "Make your email address visible on your profile"
            }
          />

          <Switch
            label={t("settings.privacy.showWeight") || "Show Weight"}
            checked={settings.showWeight}
            onChange={(e) => setSettings({ ...settings, showWeight: e.target.checked })}
            helperText={
              t("settings.privacy.showWeightHelper") || "Make your weight visible on your profile"
            }
          />

          <Switch
            label={t("settings.privacy.showFitnessLevel") || "Show Fitness Level"}
            checked={settings.showFitnessLevel}
            onChange={(e) => setSettings({ ...settings, showFitnessLevel: e.target.checked })}
            helperText={
              t("settings.privacy.showFitnessLevelHelper") ||
              "Make your fitness level visible on your profile"
            }
          />

          <div
            className="flex flex--gap-sm"
            style={{ justifyContent: "flex-end", marginTop: "var(--space-md)" }}
          >
            <Button
              variant="primary"
              onClick={() => {
                void handleSave();
              }}
              isLoading={isSaving}
            >
              {t("common.save") || "Save Changes"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
