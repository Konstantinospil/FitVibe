import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  cloneSession,
  getSession,
  updateSession,
  type SessionExercise,
  type SessionExerciseSet,
  type SessionWithExercises,
} from "../services/sessionApi";
import { useAuthStore } from "../store/auth.store";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";
import { RetryErrorPanel, StatusPanel } from "../components/composites/StatusPanel";
import { FormFeedback } from "../components/composites/FormStack";
import { CALENDAR_QUERY_KEY } from "../hooks/useSessionReschedule";

type Translate = ReturnType<typeof useTranslation>["t"];

function metric(t: Translate, key: string, value: string | number | null | undefined) {
  return value == null ? null : t(`sessionDetail.${key}`, { value });
}

function setSummary(t: Translate, set: SessionExerciseSet) {
  return [
    metric(t, "reps", set.reps),
    metric(t, "load", set.weight_kg),
    metric(t, "duration", set.duration_sec),
    metric(t, "distance", set.distance_m),
    metric(t, "rpe", set.rpe),
    metric(t, "rest", set.rest_sec),
  ].filter(Boolean).join(" · ");
}

function exerciseSummary(t: Translate, exercise: SessionExercise) {
  const planned = exercise.planned;
  return [
    metric(t, "sets", planned?.sets),
    metric(t, "reps", planned?.reps),
    metric(t, "load", planned?.load),
    metric(t, "plannedDuration", planned?.duration),
    metric(t, "plannedDistance", planned?.distance),
    metric(t, "rpe", planned?.rpe),
    metric(t, "plannedRest", planned?.rest),
  ].filter(Boolean).join(" · ");
}

const SessionExercises: React.FC<{ session: SessionWithExercises }> = ({ session }) => {
  const { t } = useTranslation();
  return (
    <TrainingPanel title={t("sessionDetail.exerciseList")}>
      {session.exercises.length === 0 ? <p>{t("sessionDetail.empty")}</p> : null}
      {session.exercises.map((exercise) => (
        <React.Fragment key={exercise.id}>
          <TrainingSummaryCard
            title={exercise.exercise_name || t("workoutEditor.exerciseFallback")}
            meta={t("sessionDetail.prescription")}
            supporting={exerciseSummary(t, exercise)}
          />
          {exercise.notes ? <p>{exercise.notes}</p> : null}
          {exercise.sets.map((set) => (
            <TrainingSummaryCard
              key={set.id}
              title={t("sessionDetail.set", { number: set.order_index })}
              meta={t(
                session.status === "completed" || set.recorded_at
                  ? "sessionDetail.actual"
                  : "sessionDetail.prescription",
              )}
              supporting={setSummary(t, set) || t("sessionDetail.unrecorded")}
            />
          ))}
        </React.Fragment>
      ))}
    </TrainingPanel>
  );
};

const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const ownerId = useAuthStore((state) => state.user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copyDate, setCopyDate] = useState("");
  const key = ["session-detail", ownerId, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getSession(id!),
    enabled: Boolean(id && ownerId),
  });
  const session = query.data;
  const isOwner = Boolean(session && ownerId && session.owner_id === ownerId);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const start = useMutation({
    mutationFn: (sessionId: string) => updateSession(sessionId, { status: "in_progress" }),
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      void queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["home", "recent-sessions"] });
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
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY });
      navigate(`/sessions/${copy.id}`);
    },
  });
  const busy = start.isPending || reuse.isPending;
  const parsedDate = new Date(copyDate);
  const validCopyDate = copyDate !== "" && Number.isFinite(parsedDate.getTime());

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
            <p>{t("sessionDetail.plannedAt")}: {dateFormat.format(new Date(session.planned_at))}</p>
            {session.started_at ? (
              <p>{t("sessionDetail.startedAt")}: {dateFormat.format(new Date(session.started_at))}</p>
            ) : null}
            {session.completed_at ? (
              <p>{t("sessionDetail.completedAt")}: {dateFormat.format(new Date(session.completed_at))}</p>
            ) : null}
            <p>{t("sessionDetail.visibility", { value: t(`visibility.${session.visibility}`) })}</p>
            {session.notes ? <p>{session.notes}</p> : null}
            {session.status === "completed" ? (
              <p>{session.points == null ? t("sessionDetail.pointsPending") : t("homeSurface.session.points", { count: session.points })}</p>
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
              <FormFeedback tone="info">{t("sessionDetail.activeNotice")}</FormFeedback>
            ) : null}
            {start.isError ? <FormFeedback tone="danger">{t("sessionDetail.saveError")}</FormFeedback> : null}
          </TrainingPanel>
          <SessionExercises session={session} />
          {isOwner && session.status !== "canceled" ? (
            <TrainingPanel title={t("sessionDetail.reuse")}>
              <label className="form-label">
                <span className="form-label-text">{t("sessionDetail.reuseDate")}</span>
                <InputControl type="datetime-local" value={copyDate} onChange={(event) => setCopyDate(event.target.value)} />
              </label>
              <Button
                variant="secondary"
                disabled={busy || !validCopyDate}
                isLoading={reuse.isPending}
                onClick={() => reuse.mutate({ sessionId: session.id, plannedAt: parsedDate.toISOString() })}
              >
                {t("sessionDetail.reuse")}
              </Button>
              {reuse.isError ? <FormFeedback tone="danger">{t("sessionDetail.saveError")}</FormFeedback> : null}
            </TrainingPanel>
          ) : null}
        </>
      ) : null}
    </main>
  );
};

export default SessionDetail;
