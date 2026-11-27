import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { getUserBadges } from "../services/api";
import { getMyVibeformProfile } from "../lib/vibeform/api";
import { VibeformRenderer } from "../lib/vibeform/components/VibeformRenderer";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import { VIBE_KEYS, type VibeKey } from "../constants/vibes";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedVibe, setSelectedVibe] = useState<VibeKey>("strength");
  const [showFitnessTestInfo, setShowFitnessTestInfo] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["vibeform", "me"],
    queryFn: getMyVibeformProfile,
  });
  const badgesQuery = useQuery({
    queryKey: ["badges", "earned"],
    queryFn: getUserBadges,
  });

  if (profileQuery.isError) {
    return (
      <main className="training-page" data-app-surface="dashboard">
        <RetryErrorPanel
          message={t("dashboard.vibeformError")}
          retryLabel={t("actions.retry")}
          onRetry={() => void profileQuery.refetch()}
          isRetrying={profileQuery.isFetching}
        />
      </main>
    );
  }

  const profile = profileQuery.data;
  const selectedValue = profile?.metrics[selectedVibe];

  return (
    <main className="training-page" aria-labelledby="dashboard-title" data-app-surface="dashboard">
      <div>
        <h1 id="dashboard-title">{t("dashboard.title")}</h1>
        <p>{t("dashboard.vibeformDescription")}</p>
      </div>

      <div className="training-grid">
        <TrainingPanel title={t("dashboard.vibeformTitle")}>
          {/* The frame reserves the Vibeform's final 240x320 box while the
              profile loads, so the panels below do not jump (issue 634, CLS). */}
          <div className="vibeform-frame" data-testid="vibeform-frame">
            {profileQuery.isLoading || !profile ? (
              <div className="training-empty">{t("dashboard.loadingVibeform")}</div>
            ) : (
              <VibeformRenderer
                className="vibeform-frame__figure"
                profile={profile}
                accessibleLabel={t("dashboard.vibeformAccessibleLabel")}
              />
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel title={t("dashboard.vibesTitle")}>
          <div className="training-scroll">
            {VIBE_KEYS.map((vibe) => (
              <Button
                key={vibe}
                type="button"
                variant={selectedVibe === vibe ? "primary" : "ghost"}
                fullWidth
                aria-pressed={selectedVibe === vibe}
                onClick={() => setSelectedVibe(vibe)}
              >
                {t(`vibes.${vibe}.name`)}
              </Button>
            ))}
          </div>
          <TrainingSummaryCard
            title={t(`vibes.${selectedVibe}.name`)}
            meta={t("dashboard.currentVibe")}
            supporting={
              selectedValue === undefined
                ? t("dashboard.valueUnavailable")
                : t("dashboard.vibeValue", { value: Math.round(selectedValue * 100) })
            }
          />
        </TrainingPanel>
      </div>

      <TrainingPanel title={t("dashboard.badgesTitle")}>
        {badgesQuery.isError ? (
          <RetryErrorPanel
            message={t("dashboard.badgesError")}
            retryLabel={t("actions.retry")}
            onRetry={() => void badgesQuery.refetch()}
            isRetrying={badgesQuery.isFetching}
          />
        ) : badgesQuery.isLoading ? (
          <div className="training-empty">{t("dashboard.loadingBadges")}</div>
        ) : badgesQuery.data?.badges.length ? (
          <div className="training-grid">
            {badgesQuery.data.badges.map((badge) => (
              <TrainingSummaryCard
                key={badge.id}
                title={badge.name}
                meta={badge.category || badge.rarity}
                supporting={badge.description}
              />
            ))}
          </div>
        ) : (
          <div className="training-empty">{t("dashboard.noBadges")}</div>
        )}
      </TrainingPanel>

      <TrainingPanel title={t("dashboard.fitnessTestTitle")}>
        <p>{t("dashboard.fitnessTestDescription")}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowFitnessTestInfo((current) => !current)}
          aria-expanded={showFitnessTestInfo}
        >
          {t("dashboard.fitnessTestAction")}
        </Button>
        {showFitnessTestInfo ? (
          <div className="training-empty">{t("dashboard.fitnessTestPending")}</div>
        ) : null}
      </TrainingPanel>
    </main>
  );
};

export default Dashboard;
