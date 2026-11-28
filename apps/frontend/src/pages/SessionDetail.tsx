import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  cloneSession,
  getSession,
  getSessionVibeChanges,
  updateSession,
  type SessionExercise,
  type SessionWithExercises,
} from "../services/sessionApi";
import { useCurrentUserId } from "../lib/auth/useCurrentUserId";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";
import { RetryErrorPanel, StatusPanel } from "../components/composites/StatusPanel";
import { FormFeedback } from "../components/composites/FormStack";
import { CALENDAR_QUERY_KEY } from "../lib/scheduling/calendarQuery";
import { durationOf, sessionEnd } from "../lib/scheduling/sessionSchedule";
import { TRAINING_DATA_CONFIG } from "../config/trainingSurfaces";
import { joinMetrics, loadMetric, metric, setSummary } from "../lib/sessions/setSummary";
import { useLoadUnit } from "../hooks/useLoadUnit";
import type { LoadUnit } from "../lib/units/load";
import { liveSessionQueryKey, liveWorkoutPath } from "../lib/execution/liveWorkout";
import { VibeChangeList } from "../components/domain/VibeChangeList";
import { SessionResultPanel } from "../components/composites/SessionResultPanel";
import { SessionIntakePanel } from "../components/composites/SessionIntakePanel";
import { isVibeKey } from "../constants/vibes";

type Translate = ReturnType<typeof useTranslation>["t"];

const SET_META_KEYS = {
  planned: "sessionDetail.prescription",
  completed: "sessionDetail.actual",
  skipped: "sessionDetail.skipped",
} as const;

function exerciseSummary(t: Translate, exercise: SessionExercise, unit: LoadUnit) {
  const planned = exercise.planned;
  return joinMetrics([
    metric(t, "sets", planned?.sets),
    metric(t, "reps", planned?.reps),
    loadMetric(t, planned?.load, unit),
    metric(t, "plannedDuration", planned?.duration),
    metric(t, "plannedDistance", planned?.distance),
    metric(t, "rpe", planned?.rpe),
    metric(t, "plannedRest", planned?.rest),
  ]);
}

const SessionExercises: React.FC<{ session: SessionWithExercises }> = ({ session }) => {
  const { t } = useTranslation();
  const { unit } = useLoadUnit();
  return (
    <TrainingPanel title={t("sessionDetail.exerciseList")}>
      {session.exercises.length === 0 ? <p>{t("sessionDetail.empty")}</p> : null}
      {session.exercises.map((exercise) => (
        <React.Fragment key={exercise.id}>
          <TrainingSummaryCard
            title={exercise.exercise_name || t("workoutEditor.exerciseFallback")}
            meta={t("sessionDetail.prescription")}
            supporting={exerciseSummary(t, exercise, unit)}
          />
          {exercise.notes ? <p>{exercise.notes}</p> : null}
          {exercise.sets.map((set) => (
            <TrainingSummaryCard
              key={set.id}
              title={t("sessionDetail.set", { number: set.order_index })}
              meta={t(SET_META_KEYS[set.status])}
              supporting={setSummary(t, set, unit)}
            />
          ))}
        </React.Fragment>
      ))}
    </TrainingPanel>
  );
};

/**
 * Read view of one of the athlete's sessions (`/sessions/:id`): schedule, status,
 * prescription and recorded sets, and awarded points once completed. The owner can
 * start a planned session and reuse any session as a new private one; completed
 * records are not edited here.
 */
const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copyDate, setCopyDate] = useState("");
  // The server decides who may read a session; ownership only decides which actions show.
  const queryKey = useMemo(() => ["session-detail", id] as const, [id]);
  const query = useQuery({
    queryKey,
    queryFn: () => getSession(id!),
    enabled: Boolean(id),
    refetchInterval: (current) =>
      current.state.data?.status === "completed" &&
      (current.state.data.points === null || current.state.data.points === undefined)
        ? TRAINING_DATA_CONFIG.pointsPendingPollMs
        : false,
  });
  const session = query.data;
  const isOwner = Boolean(session && userId && session.owner_id === userId);
  // Points and Vibe changes are written in one transaction, so once points show,
  // the changes are there too (issue 289).
  const pointsAwarded =
    session?.status === "completed" && session.points !== null && session.points !== undefined;
  const vibeChanges = useQuery({
    queryKey: ["session-vibe-changes", id],
    queryFn: () => getSessionVibeChanges(id!),
    enabled: Boolean(id) && isOwner && pointsAwarded,
  });

  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }),
    [i18n.language],
  );

  const start = useMutation({
    mutationFn: (sessionId: string) => updateSession(sessionId, { status: "in_progress" }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKey, updated);
      queryClient.setQueryData(liveSessionQueryKey(updated.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["home", "recent-sessions"] }),
      ]);
      void navigate(liveWorkoutPath(updated.id));
    },
  });

  const reuse = useMutation({
    mutationFn: ({ sessionId, plannedAt }: { sessionId: string; plannedAt: string }) =>
      cloneSession(sessionId, {
        planned_at: plannedAt,
        plan_id: null,
        visibility: "private",
        recurrence_rule: null,
        include_actual: false,
      }),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
      void navigate(`/sessions/${copy.id}`);
    },
  });

  const busy = start.isPending || reuse.isPending;
  const parsedCopyDate = new Date(copyDate);
  const validCopyDate = copyDate !== "" && Number.isFinite(parsedCopyDate.getTime());

  const scheduledRange = (value: SessionWithExercises) =>
    dateTimeFormat.formatRange(
      new Date(value.planned_at),
      new Date(sessionEnd(value.planned_at, durationOf(value))),
    );

  return (
    <main className="training-page" aria-labelledby="session-detail-title">
      <h1 id="session-detail-title">{session?.title || t("sessionDetail.title")}</h1>
      {query.isLoading ? <StatusPanel kind="loading">{t("loading.app")}</StatusPanel> : null}
      {query.isError ? (
        <RetryErrorPanel
          message={t("sessionDetail.loadError")}
          retryLabel={t("actions.retry")}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}
      {session ? (
        <>
          <TrainingPanel title={t(`sessionDetail.${session.status}`)}>
            <p>{t("sessionDetail.plannedAt", { value: scheduledRange(session) })}</p>
            {session.started_at ? (
              <p>
                {t("sessionDetail.startedAt", {
                  value: dateTimeFormat.format(new Date(session.started_at)),
                })}
              </p>
            ) : null}
            {session.completed_at ? (
              <p>
                {t("sessionDetail.completedAt", {
                  value: dateTimeFormat.format(new Date(session.completed_at)),
                })}
              </p>
            ) : null}
            <p>
              {t("sessionDetail.visibility", {
                value: t(`visibility.labels.${session.visibility}`),
              })}
            </p>
            {session.notes ? <p>{session.notes}</p> : null}
            {session.completion_outcome === "stopped_early" ? (
              <p>{t("sessionDetail.stoppedEarly")}</p>
            ) : null}
            {session.status === "completed" ? (
              <p aria-live="polite">
                {session.points === null || session.points === undefined
                  ? t("sessionDetail.pointsPending")
                  : t("homeSurface.session.points", { count: session.points })}
              </p>
            ) : null}
            {isOwner && session.status === "planned" ? (
              <Button
                disabled={busy}
                isLoading={start.isPending}
                onClick={() => start.mutate(session.id)}
              >
                {t("workoutEditor.actions.start")}
              </Button>
            ) : null}
            {isOwner && session.status === "in_progress" ? (
              <Button onClick={() => void navigate(liveWorkoutPath(session.id))}>
                {t("liveWorkout.actions.continue")}
              </Button>
            ) : null}
            {start.isError ? (
              <FormFeedback tone="danger">{t("sessionDetail.saveError")}</FormFeedback>
            ) : null}
          </TrainingPanel>
          <SessionResultPanel
            session={session}
            isOwner={isOwner}
            onChanged={(updated) => queryClient.setQueryData(queryKey, updated)}
          />
          {isOwner && session.intake ? (
            <SessionIntakePanel
              sessionId={session.id}
              intake={session.intake}
              status={session.status}
              onChanged={(intake) => queryClient.setQueryData(queryKey, { ...session, intake })}
            />
          ) : null}
          {isOwner && pointsAwarded ? (
            <TrainingPanel title={t("vibeChanges.title")} className="session-vibe-changes">
              {vibeChanges.isError ? (
                <RetryErrorPanel
                  message={t("vibeChanges.loadError")}
                  retryLabel={t("actions.retry")}
                  onRetry={() => void vibeChanges.refetch()}
                  isRetrying={vibeChanges.isFetching}
                />
              ) : vibeChanges.data ? (
                vibeChanges.data.changes.length > 0 ? (
                  <VibeChangeList
                    changes={vibeChanges.data.changes.flatMap((change) =>
                      isVibeKey(change.domain_code)
                        ? [
                            {
                              vibe: change.domain_code,
                              newLevel: change.new_level,
                              change: change.change,
                            },
                          ]
                        : [],
                    )}
                  />
                ) : (
                  <p>{t("vibeChanges.none")}</p>
                )
              ) : (
                <StatusPanel kind="loading">{t("vibeChanges.loading")}</StatusPanel>
              )}
            </TrainingPanel>
          ) : null}
          <SessionExercises session={session} />
          {isOwner && session.status !== "canceled" ? (
            <TrainingPanel title={t("sessionDetail.reuse")}>
              <label className="form-label">
                <span className="form-label-text">{t("sessionDetail.reuseDate")}</span>
                <InputControl
                  type="datetime-local"
                  value={copyDate}
                  onChange={(event) => setCopyDate(event.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={busy || !validCopyDate}
                isLoading={reuse.isPending}
                onClick={() =>
                  reuse.mutate({ sessionId: session.id, plannedAt: parsedCopyDate.toISOString() })
                }
              >
                {t("sessionDetail.reuse")}
              </Button>
              {reuse.isError ? (
                <FormFeedback tone="danger">{t("sessionDetail.saveError")}</FormFeedback>
              ) : null}
            </TrainingPanel>
          ) : null}
        </>
      ) : null}
    </main>
  );
};

export default SessionDetail;
