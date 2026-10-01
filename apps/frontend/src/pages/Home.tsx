import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, MoreHorizontal, Trophy } from "lucide-react";
import { Button } from "@fitvibe/ui";
import { getFeed, type FeedItem } from "../services/feedApi";
import { listSessions } from "../services/sessionApi";
import { TrainingPanel, TrainingSummaryCard } from "../components/domain/TrainingSurface";
import "../styles/training-surfaces.css";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

const activityAge = (value?: string | null) => {
  if (!value) return "No recorded activity yet";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const totalMinutes = Math.floor(elapsed / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const FeedCard: React.FC<{ item: FeedItem }> = ({ item }) => {
  const name = item.user.displayName || item.user.username;
  const initial = name.trim().charAt(0).toUpperCase() || "A";
  return (
    <TrainingSummaryCard
      className="home-surface__feed-card"
      meta={item.publishedAt ? formatDate(item.publishedAt) : "Not published"}
      title={
        <div className="home-surface__feed-identity">
          <span className="home-surface__avatar" aria-hidden="true">{initial}</span>
          <span>{item.session.title || "Workout"}</span>
        </div>
      }
      supporting={item.session.notes || `Shared by ${name}`}
      trailing={
        <div className="home-surface__feed-stats" aria-label="Workout engagement">
          <span><Heart aria-hidden="true" /> {item.likesCount}</span>
          <span><MessageCircle aria-hidden="true" /> {item.commentsCount}</span>
          <span><MoreHorizontal aria-hidden="true" /></span>
        </div>
      }
    />
  );
};

const Home: React.FC = () => {
  const feed = useQuery({
    queryKey: ["home", "feed"],
    queryFn: () => getFeed({ limit: 12, sort: "date" }),
    staleTime: 60_000,
  });

  const sessions = useQuery({
    queryKey: ["home", "recent-sessions"],
    queryFn: () => listSessions({ limit: 12 }),
    staleTime: 60_000,
  });

  const recentSessions = [...(sessions.data?.data ?? [])].sort(
    (a, b) => new Date(b.completed_at ?? b.planned_at).getTime() - new Date(a.completed_at ?? a.planned_at).getTime(),
  );
  const latest = recentSessions[0];

  return (
    <main className="training-page home-surface" aria-labelledby="home-title">
      <h1 id="home-title" className="sr-only">Home</h1>
      <div className="training-grid home-surface__grid">
        <TrainingPanel title="Top exercises" className="home-surface__metric">
          <div className="training-summary-card__meta">Time since last activity</div>
          <div className="home-surface__metric-value">{activityAge(latest?.completed_at ?? latest?.planned_at)}</div>
          <p>{latest ? `Last activity: ${latest.title || "Workout"}` : "Log a workout to start your activity history."}</p>
        </TrainingPanel>

        <TrainingPanel
          title="Billboard"
          className="home-surface__billboard"
          footer={
            <>
              <Button variant="ghost" size="sm">Log</Button>
              <Button variant="primary" size="sm">New</Button>
              <Button variant="secondary" size="sm">Plan</Button>
            </>
          }
        >
          {sessions.isError ? (
            <div className="training-error">Workout summaries could not be loaded.</div>
          ) : sessions.isLoading ? (
            <div className="training-empty">Loading workout summaries…</div>
          ) : recentSessions.length === 0 ? (
            <div className="training-empty">No workout summaries yet.</div>
          ) : (
            <div className="home-surface__feed-list">
              {recentSessions.slice(0, 10).map((session) => (
                <TrainingSummaryCard
                  key={session.id}
                  meta={formatDate(session.completed_at ?? session.planned_at)}
                  title={session.title || "Workout summary"}
                  supporting={session.notes || `${session.exercises.length} exercise${session.exercises.length === 1 ? "" : "s"}`}
                  icon={<Trophy aria-hidden="true" />}
                  trailing={session.points != null ? `${session.points} points` : undefined}
                />
              ))}
            </div>
          )}
        </TrainingPanel>

        <TrainingPanel title="News feed" className="home-surface__feed">
          <div className="training-scroll" aria-live="polite">
            {feed.isError ? (
              <div className="training-error">The news feed could not be loaded.</div>
            ) : feed.isLoading ? (
              <div className="training-empty">Loading news feed…</div>
            ) : (feed.data?.items.length ?? 0) === 0 ? (
              <div className="training-empty">No shared workouts yet.</div>
            ) : (
              <div className="home-surface__news-list">
                {feed.data?.items.map((item) => <FeedCard key={item.feedItemId} item={item} />)}
              </div>
            )}
          </div>
        </TrainingPanel>
      </div>
    </main>
  );
};

export default Home;
