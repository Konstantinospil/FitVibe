import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageIntro from "../components/PageIntro";
import { SessionManagement } from "../components/SessionManagement";
import {
  AccountDeletionForm,
  AvatarUpload,
  BodyProgressSettings,
  MeasurementDiscoverySettings,
  MeasurementValuesSettings,
  DataExportButton,
  PrivacySettings,
  PreferencesSettings,
  ProfileForm,
  SecuritySettings,
  SettingsTabs,
} from "../components/profile";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { apiClient, getCurrentUser, type UserProfile } from "../services/api";
import { logger } from "../utils/logger";

const Settings: React.FC = () => {
  const { t } = useTranslation("common");
  const [user, setUser] = useState<UserProfile | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      logger.apiError("Failed to load user settings", error, "/api/v1/users/me", "GET");
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const avatarUrl = (() => {
    const value = user?.avatarUrl;
    if (!value) {
      return null;
    }
    if (value.startsWith("http")) {
      return value;
    }
    return `${apiClient.defaults.baseURL ?? ""}${value}`;
  })();

  return (
    <PageIntro
      eyebrow={t("settings.title")}
      title={t("settings.description")}
      description={t("settings.introDescription")}
    >
      <div style={{ maxWidth: "1000px" }}>
        <SettingsTabs
          profileContent={
            <div className="grid grid--gap-lg">
              <Card>
                <CardHeader>
                  <CardTitle>{t("settings.profile.avatar") || "Profile photo"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <AvatarUpload
                    currentAvatarUrl={avatarUrl}
                    onUploadSuccess={() => void loadUser()}
                    onDeleteSuccess={() => void loadUser()}
                  />
                </CardContent>
              </Card>
              <PreferencesSettings onUpdate={() => void loadUser()} />
              <ProfileForm onSave={() => void loadUser()} />
            </div>
          }
          progressContent={
            <div className="grid grid--gap-lg">
              <MeasurementDiscoverySettings />
              <MeasurementValuesSettings />
              <BodyProgressSettings />
            </div>
          }
          securityContent={
            <div className="grid grid--gap-lg">
              <SecuritySettings />
              <SessionManagement />
            </div>
          }
          privacyContent={
            <div className="grid grid--gap-lg">
              <PrivacySettings />
              <DataExportButton />
              <AccountDeletionForm />
            </div>
          }
        />
      </div>
    </PageIntro>
  );
};

export default Settings;
