import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getFeed, listSessions, type SessionWithExercises } from "../services/api";
import HomeFeedCard from "../components/composites/HomeFeedCard";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";
import { TRAINING_DATA_CONFIG, TRAINING_TIME_UNITS } from "../config/trainingSurfaces";
import { logger } from "../utils/logger";

const sessionSummary = (session: SessionWithExercises, t: ReturnType<typeof useTranslation>["t"]) =>
  session.notes ||
  t("homeSurface.session.exercises", {
    count: session.exercises.length,
  });

const Home: React.FC = () => {
  const { t, i18n } = useTranslation();

  const recentFeed = useQuery({
    queryKey: ["home", "feed", "date"],
    queryFn: () =>
      getFeed({
        scope: "public",
        limit: TRAINING_DATA_CONFIG.homeRecentFeedLimit,
        sort: "date",
      }),
    staleTime: TRAINING_DATA_CONFIG.standardQueryStaleMs,
  });

  const trendingFeed = useQuery({
    queryKey: ["home", "feed", "popularity"],
    queryFn: () =>
      getFeed({
        scope: "public",
        limit: TRAINING_DATA_CONFIG.homeTrendingFeedLimit,
        sort: "popularity",
      }),
    staleTime: TRAINING_DATA_CONFIG.standardQueryStaleMs,
  });

  const sessions = useQuery({
    queryKey: ["home", "recent-sessions"],
    queryFn: () =>
      listSessions({
        status: "completed",
        limit: TRAINING_DATA_CONFIG.homeRecentFeedLimit,
      }),
    staleTime: TRAINING_DATA_CONFIG.standardQueryStaleMs,
  });

  useEffect(() => {
    if (recentFeed.error) {
      logger.apiError("Failed to load Home news feed", recentFeed.error, "/api/v1/feed", "GET");
    }
  }, [recentFeed.error]);

  useEffect(() => {
    if (trendingFeed.error) {
      logger.apiError(
        "Failed to load Home trending workouts",
        trendingFeed.error,
        "/api/v1/feed",
        "GET",
      );
    }
  }, [trendingFeed.error]);

  useEffect(() => {
    if (sessions.error) {
      logger.apiError("Failed to load Home activities", sessions.error, "/api/v1/sessions", "GET");
    }
  }, [sessions.error]);

  const completedSessions = useMemo(
    () =>
      [...(sessions.data?.data ?? [])]
        .filter((session) => session.status === "completed" || Boolean(session.completed_at))
        .sort(
          (a, b) =>
            new Date(b.completed_at ?? b.planned_at).getTime() -
            new Date(a.completed_at ?? a.planned_at).getTime(),
        ),
    [sessions.data],
  );

  const latest = completedSessions[0];

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const activityAge = (value?: string | null) => {
    if (!value) {
      return t("homeSurface.activity.noActivity");
    }

    const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
    const totalMinutes = Math.floor(elapsed / TRAINING_TIME_UNITS.millisecondsPerMinute);
    const days = Math.floor(totalMinutes / TRAINING_TIME_UNITS.minutesPerDay);
    const hours = Math.floor(
      (totalMinutes % TRAINING_TIME_UNITS.minutesPerDay) / TRAINING_TIME_UNITS.minutesPerHour,
    );
    const minutes = totalMinutes % TRAINING_TIME_UNITS.minutesPerHour;

    return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  return (
    <main className="training-page home-surface" aria-labelledby="home-title">
      <h1 id="home-title" className="sr-only">
        {t("homeSurface.title")}
      </h1>

      <div className="training-grid home-surface__grid">
        <TrainingPanel
          title={t("homeSurface.sections.recentActivity")}
          className="home-surface__metric"
        >
          <div className="training-summary-card__meta">
            {t("homeSurface.activity.timeSinceLast")}
          </div>
          <div className="home-surface__metric-value">
            {activityAge(latest?.completed_at ?? latest?.planned_at)}
          </div>
          <p>
            {latest
              ? t("homeSurface.activity.lastActivity", {
                  name: latest.title || t("homeSurface.session.workout"),
                })
              : t("homeSurface.activity.startHint")}
          </p>
        </TrainingPanel>

        <TrainingPanel
          title={t("homeSurface.sections.trending")}
          className="home-surface__trending"
        >
          {trendingFeed.isError ? (
            <RetryErrorPanel
              message={t("homeSurface.errors.trending")}
              retryLabel={t("actions.retry")}
              onRetry={() => {
                void trendingFeed.refetch();
              }}
              isRetrying={trendingFeed.isFetching}
            />
          ) : trendingFeed.isLoading ? (
            <div className="training-empty">{t("homeSurface.loading.trending")}</div>
          ) : (trendingFeed.data?.items.length ?? 0) === 0 ? (
            <div className="training-empty">{t("homeSurface.empty.trending")}</div>
          ) : (
            <div className="home-surface__trending-list">
              {trendingFeed.data?.items.map((item) => (
                <HomeFeedCard key={item.feedItemId} item={item} />
              ))}
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title={t("homeSurface.sections.newsFeed")} className="home-surface__feed">
          <div className="training-scroll" aria-live="polite">
            {recentFeed.isError ? (
              <RetryErrorPanel
                message={t("homeSurface.errors.news")}
                retryLabel={t("actions.retry")}
                onRetry={() => {
                  void recentFeed.refetch();
                }}
                isRetrying={recentFeed.isFetching}
              />
            ) : recentFeed.isLoading ? (
              <div className="training-empty">{t("homeSurface.loading.news")}</div>
            ) : (recentFeed.data?.items.length ?? 0) === 0 ? (
              <div className="training-empty">{t("homeSurface.empty.news")}</div>
            ) : (
              <div className="home-surface__news-list">
                {recentFeed.data?.items.map((item) => (
                  <HomeFeedCard key={item.feedItemId} item={item} />
                ))}
              </div>
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel
          title={t("homeSurface.sections.previousActivities")}
          className="home-surface__activities"
        >
          {sessions.isError ? (
            <RetryErrorPanel
              message={t("homeSurface.errors.activities")}
              retryLabel={t("actions.retry")}
              onRetry={() => {
                void sessions.refetch();
              }}
              isRetrying={sessions.isFetching}
            />
          ) : sessions.isLoading ? (
            <div className="training-empty">{t("homeSurface.loading.activities")}</div>
          ) : completedSessions.length === 0 ? (
            <div className="training-empty">{t("homeSurface.empty.activities")}</div>
          ) : (
            <div className="home-surface__activity-list">
              {completedSessions
                .slice(0, TRAINING_DATA_CONFIG.homePreviousActivitiesLimit)
                .map((session) => (
                  <TrainingSummaryCard
                    key={session.id}
                    meta={formatDate(session.completed_at ?? session.planned_at)}
                    title={session.title || t("homeSurface.session.workoutSummary")}
                    supporting={sessionSummary(session, t)}
                    trailing={
                      session.points !== null && session.points !== undefined
                        ? t("homeSurface.session.points", {
                            count: session.points,
                          })
                        : undefined
                    }
                  />
                ))}
            </div>
          )}
        </TrainingPanel>
      </div>
    </main>
  );
};

export default Home;
