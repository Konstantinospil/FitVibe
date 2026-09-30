import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { Alert } from "../ui/Alert";
import { getCurrentUser, updateProfile, type UpdateProfileRequest } from "../../services/api";
import { useToast } from "../ui/Toast";
import { getErrorMessageSync } from "../../utils/errorMessages";

export interface ProfileFormProps {
  onSave?: () => void;
}

/**
 * ProfileForm component for editing user profile.
 * Handles display name, bio, alias, weight, fitness level, and training frequency.
 */
export const ProfileForm: React.FC<ProfileFormProps> = ({ onSave }) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    displayName: "",
    bio: "",
    alias: "",
    weight: undefined,
    weightUnit: "kg",
    fitnessLevel: undefined,
    trainingFrequency: undefined,
  });

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const profile = await getCurrentUser();
        setFormData({
          displayName: profile.displayName || "",
          bio: profile.bio || "",
          alias: profile.alias || "",
          weight: profile.weight ?? undefined,
          weightUnit: (profile.weightUnit as "kg" | "lb") || "kg",
          fitnessLevel:
            (profile.fitnessLevel as
              "beginner" | "intermediate" | "advanced" | "elite" | undefined) ?? undefined,
          trainingFrequency:
            (profile.trainingFrequency as
              "rarely" | "1_2_per_week" | "3_4_per_week" | "5_plus_per_week" | undefined) ??
            undefined,
        });
      } catch (err) {
        const errorMessage = getErrorMessageSync(
          err,
          t,
          "settings.profile.loadError",
          "Failed to load profile",
        );
        setError(errorMessage);
        showToast({
          variant: "error",
          title: t("common.error") || "Error",
          message: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };
    void loadProfile();
  }, [t, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await updateProfile(formData);
      showToast({
        variant: "success",
        title: t("settings.profile.saved") || "Profile Updated",
        message: t("settings.profile.savedMessage") || "Your profile has been updated successfully",
      });
      onSave?.();
    } catch {
      setError(t("settings.profile.saveError") || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const fitnessLevelOptions = [
    { value: "beginner", label: t("settings.profile.fitnessLevelBeginner") || "Beginner" },
    {
      value: "intermediate",
      label: t("settings.profile.fitnessLevelIntermediate") || "Intermediate",
    },
    { value: "advanced", label: t("settings.profile.fitnessLevelAdvanced") || "Advanced" },
    { value: "elite", label: t("settings.profile.fitnessLevelElite") || "Elite" },
  ];

  const trainingFrequencyOptions = [
    { value: "rarely", label: t("settings.profile.trainingFrequencyRarely") || "Rarely" },
    {
      value: "1_2_per_week",
      label: t("settings.profile.trainingFrequency1_2") || "1-2 times per week",
    },
    {
      value: "3_4_per_week",
      label: t("settings.profile.trainingFrequency3_4") || "3-4 times per week",
    },
    {
      value: "5_plus_per_week",
      label: t("settings.profile.trainingFrequency5Plus") || "5+ times per week",
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div style={{ padding: "var(--space-xl)", textAlign: "center" }}>
            <div className="spinner" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.title") || "Profile Settings"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex flex--column flex--gap-lg"
        >
          {error && <Alert variant="danger">{error}</Alert>}

          <Input
            label={t("settings.profile.displayName") || "Display Name"}
            value={formData.displayName || ""}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder={t("settings.profile.displayNamePlaceholder") || "Your display name"}
            maxLength={120}
          />

          <Input
            label={t("settings.profile.alias") || "Alias"}
            value={formData.alias || ""}
            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
            placeholder={t("settings.profile.aliasPlaceholder") || "Your alias (URL-friendly)"}
            helperText={
              t("settings.profile.aliasHelp") ||
              "3-50 characters, letters, numbers, underscores, dots, or dashes"
            }
            maxLength={50}
          />

          <Textarea
            label={t("settings.profile.bio") || "Bio"}
            value={formData.bio || ""}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder={t("settings.profile.bioPlaceholder") || "Tell us about yourself"}
            rows={4}
            maxLength={500}
          />

          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: "var(--space-md)" }}>
            <Input
              label={t("settings.profile.weight") || "Weight"}
              type="number"
              value={formData.weight?.toString() || ""}
              onChange={(e) => {
                const value = e.target.value ? parseFloat(e.target.value) : undefined;
                setFormData({ ...formData, weight: value });
              }}
              placeholder="0"
              min={20}
              max={500}
              step="0.1"
            />

            <Select
              label={t("settings.profile.weightUnit") || "Unit"}
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
              value={formData.weightUnit || "kg"}
              onChange={(e) =>
                setFormData({ ...formData, weightUnit: e.target.value as "kg" | "lb" })
              }
            />
          </div>

          <Select
            label={t("settings.profile.fitnessLevel") || "Fitness Level"}
            options={fitnessLevelOptions}
            value={formData.fitnessLevel || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                fitnessLevel: e.target.value as UpdateProfileRequest["fitnessLevel"],
              })
            }
            placeholder={t("settings.profile.fitnessLevelPlaceholder") || "Select fitness level"}
          />

          <Select
            label={t("settings.profile.trainingFrequency") || "Training Frequency"}
            options={trainingFrequencyOptions}
            value={formData.trainingFrequency || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                trainingFrequency: e.target.value as UpdateProfileRequest["trainingFrequency"],
              })
            }
            placeholder={
              t("settings.profile.trainingFrequencyPlaceholder") || "Select training frequency"
            }
          />

          <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {t("common.save") || "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
