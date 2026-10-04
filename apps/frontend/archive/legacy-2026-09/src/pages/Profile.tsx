import React from "react";
import { useTranslation } from "react-i18next";
import PageIntro from "../components/PageIntro";
import { ProfileMeasurements } from "../components/profile";
import { Button } from "../components/ui";

const Profile: React.FC = () => {
  const { t } = useTranslation();

  const sections = ["visibility", "units", "achievements"] as const;

  return (
    <PageIntro
      eyebrow={t("profile.eyebrow")}
      title={t("profile.title")}
      description={t("profile.description")}
    >
      <div
        className="grid grid--gap-md rounded-lg p-lg"
        style={{
          background: "var(--color-surface-glass)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="grid grid--gap-075">
          {sections.map((section) => (
            <div key={section} className="grid" style={{ gap: "0.3rem" }}>
              <strong>{t(`profile.sections.${section}.title`)}</strong>
              <span className="text-secondary">{t(`profile.sections.${section}.description`)}</span>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" style={{ justifySelf: "flex-start" }}>
          {t("profile.edit")}
        </Button>
      </div>
      <ProfileMeasurements />
    </PageIntro>
  );
};

export default Profile;
