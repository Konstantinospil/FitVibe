import React from "react";
import { useQuery } from "@tanstack/react-query";
import { BUTTON_ICON_SIZES } from "@fitvibe/ui";
import nodIcon from "../assets/nod.svg";
import {
  getFeed,
  listSessions,
  type FeedItem,
  type SessionWithExercises,
} from "../services/api";
import {
  TrainingPanel,
  TrainingSummaryCard,
} from "../components/composites/TrainingSurface";
import "../styles/training-surfaces.css";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const activityAge = (value?: string | null) => {
  if (!value) {
    return "No recorded activity yet";
  }

  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const totalMinutes = Math.floor(elapsed / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const sessionSummary = (session: SessionWithExercises) =>
  session.notes ||
  `${session.exercises.length} exercise${session.exercises.length === 1 ? "" : "s"}`;

const FeedCard: React.FC<{ item: FeedItem }> = ({ item }) => {
  const name = item.user.displayName || item.user.username;
  const initial = name.trim().charAt(0).toUpperCase() || "A";

  return (
    <TrainingSummaryCard
      className="home-surface__feed-card"
      meta={item.publishedAt ? formatDate(item.publishedAt) : "Not published"}
      title={
        <div className="home-surface__feed-identity">
          <span className="home-surface__avatar" aria-hidden="true">
            {initial}
          </span>
          <span>{item.session.title || "Workout"}</span>
        </div>
      }
      supporting={item.session.notes || `Shared by ${name}`}
      trailing={
        <div className="home-surface__nod-count" aria-label="Nods">
          <img
            src={nodIcon}
            alt=""
            width={BUTTON_ICON_SIZES.md}
            height={BUTTON_ICON_SIZES.md}
          />
          <span>{item.likesCount}</span>
        </div>
      }
    />
  );
};

const Home: React.FC = () => {
  const recentFeed = useQuery({
    queryKey: ["home", "feed", "date"],
    queryFn: () => getFeed({ limit: 12, sort: "date" }),
    staleTime: 60_000,
  });

  const trendingFeed = useQuery({
    queryKey: ["home", "feed", "popularity"],
    queryFn: () => getFeed({ limit: 10, sort: "popularity" }),
    staleTime: 60_000,
  });

  const sessions = useQuery({
    queryKey: ["home", "recent-sessions"],
    queryFn: () => listSessions({ limit: 12 }),
    staleTime: 60_000,
  });

  const recentSessions = [...(sessions.data?.data ?? [])].sort(
    (a, b) =>
      new Date(b.completed_at ?? b.planned_at).getTime() -
      new Date(a.completed_at ?? a.planned_at).getTime(),
  );
  const latest = recentSessions[0];

  return (
    <main className="training-page home-surface" aria-labelledby="home-title">
      <h1 id="home-title" className="sr-only">
        Home
      </h1>

      <div className="training-grid home-surface__grid">
        <TrainingPanel title="Recent activity" className="home-surface__metric">
          <div className="training-summary-card__meta">Time since last activity</div>
          <div className="home-surface__metric-value">
            {activityAge(latest?.completed_at ?? latest?.planned_at)}
          </div>
          <p>
            {latest
              ? `Last activity: ${latest.title || "Workout"}`
              : "Log a workout to start your activity history."}
          </p>
        </TrainingPanel>

        <TrainingPanel title="Trending workouts" className="home-surface__billboard">
          {trendingFeed.isError ? (
            <div className="training-error">Trending workouts could not be loaded.</div>
          ) : trendingFeed.isLoading ? (
            <div className="training-empty">Loading trending workouts…</div>
          ) : (trendingFeed.data?.items.length ?? 0) === 0 ? (
            <div className="training-empty">No trending workouts yet.</div>
          ) : (
            <div className="home-surface__feed-list">
              {trendingFeed.data?.items.map((item) => (
                <FeedCard key={item.feedItemId} item={item} />
              ))}
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title="News feed" className="home-surface__feed">
          <div className="training-scroll" aria-live="polite">
            {recentFeed.isError ? (
              <div className="training-error">The news feed could not be loaded.</div>
            ) : recentFeed.isLoading ? (
              <div className="training-empty">Loading news feed…</div>
            ) : (recentFeed.data?.items.length ?? 0) === 0 ? (
              <div className="training-empty">No shared workouts yet.</div>
            ) : (
              <div className="home-surface__news-list">
                {recentFeed.data?.items.map((item) => (
                  <FeedCard key={item.feedItemId} item={item} />
                ))}
              </div>
            )}
          </div>
        </TrainingPanel>

        <TrainingPanel title="Previous activities" className="home-surface__activities">
          {sessions.isError ? (
            <div className="training-error">Previous activities could not be loaded.</div>
          ) : sessions.isLoading ? (
            <div className="training-empty">Loading previous activities…</div>
          ) : recentSessions.length === 0 ? (
            <div className="training-empty">No previous activities yet.</div>
          ) : (
            <div className="home-surface__activity-list">
              {recentSessions.slice(0, 6).map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  meta={formatDate(session.completed_at ?? session.planned_at)}
                  title={session.title || "Workout summary"}
                  supporting={sessionSummary(session)}
                  trailing={
                    session.points !== null && session.points !== undefined
                      ? `${session.points} points`
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
