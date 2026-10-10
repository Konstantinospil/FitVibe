import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, InputControl, SelectControl, Switch, TextareaControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  get2FAStatus,
  getCurrentUser,
  getPrivacySettings,
  getUserPreferences,
  updatePrivacySettings,
  updateProfile,
  updateUserPreferences,
} from "../services/api";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import { getMyVibeformProfile, updateMyVibeformPreferences } from "../lib/vibeform/api";
import { TrainingPanel } from "../components/composites/TrainingSurface";

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["settings", "profile"],
    queryFn: getCurrentUser,
  });
  const preferencesQuery = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: getUserPreferences,
  });
  const privacyQuery = useQuery({
    queryKey: ["settings", "privacy"],
    queryFn: getPrivacySettings,
  });
  const twoFactorQuery = useQuery({
    queryKey: ["settings", "2fa-status"],
    queryFn: get2FAStatus,
  });
  const vibeformQuery = useQuery({
    queryKey: ["vibeform", "me"],
    queryFn: getMyVibeformProfile,
  });

  const [displayName, setDisplayName] = useState("");
  const [alias, setAlias] = useState("");
  const [bio, setBio] = useState("");
  const [weight, setWeight] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [trainingFrequency, setTrainingFrequency] = useState("");
  const [language, setLanguage] = useState("en");
  const [measurementSystem, setMeasurementSystem] = useState("metric");
  const [defaultVisibility, setDefaultVisibility] = useState("private");
  const [allowFollowers, setAllowFollowers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [showFitnessLevel, setShowFitnessLevel] = useState(false);
  const [vibeformTemplate, setVibeformTemplate] = useState<"flow">("flow");
  const [vibeformBodyProfile, setVibeformBodyProfile] = useState<
    "shoulder-dominant" | "balanced" | "hip-dominant"
  >("balanced");
  const [vibeformMotionEnabled, setVibeformMotionEnabled] = useState(true);
  const [savingSection, setSavingSection] = useState<
    "profile" | "preferences" | "privacy" | "vibeform" | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    setDisplayName(profileQuery.data.displayName ?? "");
    setAlias(profileQuery.data.alias ?? "");
    setBio(profileQuery.data.bio ?? "");
    const storedWeightKg = profileQuery.data.weight;
    if (storedWeightKg == null) {
      setWeight("");
    } else if (preferencesQuery.data?.measurementSystem === "imperial") {
      setWeight((storedWeightKg / 0.453592).toFixed(2).replace(/\.00$/, ""));
    } else {
      setWeight(String(storedWeightKg));
    }
    setFitnessLevel(profileQuery.data.fitnessLevel ?? "");
    setTrainingFrequency(profileQuery.data.trainingFrequency ?? "");
  }, [profileQuery.data, preferencesQuery.data?.measurementSystem]);

  useEffect(() => {
    if (!preferencesQuery.data) {
      return;
    }
    setLanguage(preferencesQuery.data.language);
    setMeasurementSystem(preferencesQuery.data.measurementSystem);
  }, [preferencesQuery.data]);

  useEffect(() => {
    if (!privacyQuery.data) {
      return;
    }
    setDefaultVisibility(privacyQuery.data.defaultVisibility);
    setAllowFollowers(privacyQuery.data.allowFollowers);
    setShowEmail(privacyQuery.data.showEmail);
    setShowWeight(privacyQuery.data.showWeight);
    setShowFitnessLevel(privacyQuery.data.showFitnessLevel);
  }, [privacyQuery.data]);

  useEffect(() => {
    if (!vibeformQuery.data) {
      return;
    }
    setVibeformTemplate(vibeformQuery.data.preferences.templateCode);
    setVibeformBodyProfile(vibeformQuery.data.preferences.bodyProfile);
    setVibeformMotionEnabled(vibeformQuery.data.preferences.motionEnabled);
  }, [vibeformQuery.data]);

  const saveProfile = async () => {
    setSavingSection("profile");
    setFeedback(null);
    try {
      const parsedWeight = weight.trim() === "" ? undefined : Number(weight);
      await updateProfile({
        displayName: displayName.trim(),
        alias: alias.trim(),
        bio: bio.trim(),
        weight: parsedWeight,
        weightUnit: parsedWeight === undefined
          ? undefined
          : preferencesQuery.data?.measurementSystem === "imperial"
            ? "lb"
            : "kg",
        fitnessLevel: fitnessLevel
          ? (fitnessLevel as "beginner" | "intermediate" | "advanced" | "elite")
          : undefined,
        trainingFrequency: trainingFrequency
          ? (trainingFrequency as
              | "rarely"
              | "1_2_per_week"
              | "3_4_per_week"
              | "5_plus_per_week")
          : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["settings", "profile"] });
      setFeedback(t("settings.profile.savedMessage"));
    } catch {
      setFeedback(t("settings.profile.saveError"));
    } finally {
      setSavingSection(null);
    }
  };

  const savePreferences = async () => {
    setSavingSection("preferences");
    setFeedback(null);
    try {
      await updateUserPreferences({
        language: language as "en" | "de" | "fr" | "es" | "el",
        measurementSystem: measurementSystem as "metric" | "imperial",
      });
      await queryClient.invalidateQueries({ queryKey: ["settings", "preferences"] });
      setFeedback(t("settings.preferences.saveSuccess"));
    } catch {
      setFeedback(t("settings.preferences.saveError"));
    } finally {
      setSavingSection(null);
    }
  };

  const saveVibeform = async () => {
    setSavingSection("vibeform");
    setFeedback(null);
    try {
      await updateMyVibeformPreferences({
        templateCode: vibeformTemplate,
        bodyProfile: vibeformBodyProfile,
        motionEnabled: vibeformMotionEnabled,
      });
      await queryClient.invalidateQueries({ queryKey: ["vibeform", "me"] });
      setFeedback(t("settings.vibeform.savedMessage"));
    } catch {
      setFeedback(t("settings.vibeform.saveError"));
    } finally {
      setSavingSection(null);
    }
  };

  const savePrivacy = async () => {
    setSavingSection("privacy");
    setFeedback(null);
    try {
      await updatePrivacySettings({
        defaultVisibility: defaultVisibility as "private" | "followers" | "link" | "public",
        allowFollowers,
        showEmail,
        showWeight,
        showFitnessLevel,
      });
      await queryClient.invalidateQueries({ queryKey: ["settings", "privacy"] });
      setFeedback(t("settings.privacy.savedMessage"));
    } catch {
      setFeedback(t("settings.privacy.saveError"));
    } finally {
      setSavingSection(null);
    }
  };

  const primaryError =
    profileQuery.isError ||
    preferencesQuery.isError ||
    privacyQuery.isError ||
    twoFactorQuery.isError ||
    vibeformQuery.isError;

  if (primaryError) {
    return (
      <main className="training-page" data-app-surface="settings">
        <RetryErrorPanel
          message={t("settings.description")}
          retryLabel={t("actions.retry")}
          onRetry={() => {
            void Promise.all([
              profileQuery.refetch(),
              preferencesQuery.refetch(),
              privacyQuery.refetch(),
              twoFactorQuery.refetch(),
              vibeformQuery.refetch(),
            ]);
          }}
          isRetrying={
            profileQuery.isFetching ||
            preferencesQuery.isFetching ||
            privacyQuery.isFetching ||
            twoFactorQuery.isFetching ||
            vibeformQuery.isFetching
          }
        />
      </main>
    );
  }

  return (
    <main className="training-page" aria-labelledby="settings-title" data-app-surface="settings">
      <div>
        <h1 id="settings-title">{t("settings.title")}</h1>
        <p>{t("settings.introDescription")}</p>
      </div>

      {feedback ? (
        <div className="training-empty" role="status">
          {feedback}
        </div>
      ) : null}

      <div className="training-grid">
        <TrainingPanel title={t("settings.profile.title")}>
          {profileQuery.isLoading ? (
            <div className="training-empty">{t("common.loading")}</div>
          ) : (
            <div className="form">
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.displayName")}</span>
                <InputControl
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.alias")}</span>
                <InputControl value={alias} onChange={(event) => setAlias(event.target.value)} />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.bio")}</span>
                <TextareaControl value={bio} onChange={(event) => setBio(event.target.value)} />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.weight")}</span>
                <InputControl
                  type="number"
                  min={preferencesQuery.data?.measurementSystem === "imperial" ? 44.09 : 20}
                  max={preferencesQuery.data?.measurementSystem === "imperial" ? 881.85 : 400}
                  step="0.01"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.weightUnit")}</span>
                <InputControl
                  value={
                    preferencesQuery.data?.measurementSystem === "imperial"
                      ? t("settings.profile.weightLb")
                      : t("settings.profile.weightKg")
                  }
                  readOnly
                />
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.fitnessLevel")}</span>
                <SelectControl
                  value={fitnessLevel}
                  onChange={(event) => setFitnessLevel(event.target.value)}
                >
                  <option value="">{t("common.select")}</option>
                  <option value="beginner">{t("settings.profile.fitnessLevelBeginner")}</option>
                  <option value="intermediate">
                    {t("settings.profile.fitnessLevelIntermediate")}
                  </option>
                  <option value="advanced">{t("settings.profile.fitnessLevelAdvanced")}</option>
                  <option value="elite">{t("settings.profile.fitnessLevelElite")}</option>
                </SelectControl>
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.profile.trainingFrequency")}</span>
                <SelectControl
                  value={trainingFrequency}
                  onChange={(event) => setTrainingFrequency(event.target.value)}
                >
                  <option value="">{t("common.select")}</option>
                  <option value="rarely">{t("settings.profile.trainingFrequencyRarely")}</option>
                  <option value="1_2_per_week">{t("settings.profile.trainingFrequency1_2")}</option>
                  <option value="3_4_per_week">{t("settings.profile.trainingFrequency3_4")}</option>
                  <option value="5_plus_per_week">
                    {t("settings.profile.trainingFrequency5Plus")}
                  </option>
                </SelectControl>
              </label>
              <Button
                type="button"
                onClick={() => void saveProfile()}
                isLoading={savingSection === "profile"}
              >
                {t("common.save")}
              </Button>
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title={t("settings.preferences.title")}>
          {preferencesQuery.isLoading ? (
            <div className="training-empty">{t("common.loading")}</div>
          ) : (
            <div className="form">
              <label className="form-label">
                <span className="form-label-text">{t("settings.preferences.language")}</span>
                <SelectControl
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="el">Ελληνικά</option>
                </SelectControl>
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.preferences.units")}</span>
                <SelectControl
                  value={measurementSystem}
                  onChange={(event) => setMeasurementSystem(event.target.value)}
                >
                  <option value="metric">{t("settings.preferences.unitsMetric")}</option>
                  <option value="imperial">{t("settings.preferences.unitsImperial")}</option>
                </SelectControl>
              </label>
              <Button
                type="button"
                onClick={() => void savePreferences()}
                isLoading={savingSection === "preferences"}
              >
                {t("settings.preferences.saveButton")}
              </Button>
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title={t("settings.vibeform.title")}>
          {vibeformQuery.isLoading ? (
            <div className="training-empty">{t("common.loading")}</div>
          ) : (
            <div className="form">
              <label className="form-label">
                <span className="form-label-text">{t("settings.vibeform.template")}</span>
                <SelectControl
                  value={vibeformTemplate}
                  onChange={(event) => setVibeformTemplate(event.target.value as "flow")}
                >
                  <option value="flow">{t("settings.vibeform.templates.flow")}</option>
                </SelectControl>
              </label>
              <label className="form-label">
                <span className="form-label-text">{t("settings.vibeform.bodyProfile")}</span>
                <SelectControl
                  value={vibeformBodyProfile}
                  onChange={(event) =>
                    setVibeformBodyProfile(
                      event.target.value as "shoulder-dominant" | "balanced" | "hip-dominant",
                    )
                  }
                >
                  <option value="shoulder-dominant">
                    {t("settings.vibeform.bodyProfiles.shoulderDominant")}
                  </option>
                  <option value="balanced">{t("settings.vibeform.bodyProfiles.balanced")}</option>
                  <option value="hip-dominant">
                    {t("settings.vibeform.bodyProfiles.hipDominant")}
                  </option>
                </SelectControl>
              </label>
              <Switch
                label={t("settings.vibeform.motion")}
                checked={vibeformMotionEnabled}
                onChange={(event) => setVibeformMotionEnabled(event.target.checked)}
              />
              <p>{t("settings.vibeform.description")}</p>
              <Button
                type="button"
                onClick={() => void saveVibeform()}
                isLoading={savingSection === "vibeform"}
              >
                {t("common.save")}
              </Button>
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title={t("settings.privacy.title")}>
          {privacyQuery.isLoading ? (
            <div className="training-empty">{t("common.loading")}</div>
          ) : (
            <div className="form">
              <label className="form-label">
                <span className="form-label-text">{t("settings.privacy.defaultVisibility")}</span>
                <SelectControl
                  value={defaultVisibility}
                  onChange={(event) => setDefaultVisibility(event.target.value)}
                >
                  <option value="private">{t("visibility.labels.private")}</option>
                  <option value="followers">{t("visibility.labels.followers")}</option>
                  <option value="link">{t("visibility.labels.link")}</option>
                  <option value="public">{t("visibility.labels.public")}</option>
                </SelectControl>
              </label>
              <Switch
                label={t("settings.privacy.allowFollowers")}
                checked={allowFollowers}
                onChange={(event) => setAllowFollowers(event.target.checked)}
              />
              <Switch
                label={t("settings.privacy.showEmail")}
                checked={showEmail}
                onChange={(event) => setShowEmail(event.target.checked)}
              />
              <Switch
                label={t("settings.privacy.showWeight")}
                checked={showWeight}
                onChange={(event) => setShowWeight(event.target.checked)}
              />
              <Switch
                label={t("settings.privacy.showFitnessLevel")}
                checked={showFitnessLevel}
                onChange={(event) => setShowFitnessLevel(event.target.checked)}
              />
              <Button
                type="button"
                onClick={() => void savePrivacy()}
                isLoading={savingSection === "privacy"}
              >
                {t("common.save")}
              </Button>
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title={t("settings.security.title")}>
          {twoFactorQuery.isLoading ? (
            <div className="training-empty">{t("common.loading")}</div>
          ) : (
            <div className="form">
              <strong>
                {twoFactorQuery.data?.enabled
                  ? t("settings.security.enabled")
                  : t("settings.security.disabled")}
              </strong>
              <p>
                {twoFactorQuery.data?.enabled
                  ? t("settings.security.enabledHelp")
                  : t("settings.security.disabledHelp")}
              </p>
            </div>
          )}
        </TrainingPanel>
      </div>
    </main>
  );
};

export default Settings;
