import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  cloneSession, getSession, updateSession,
  type SessionExercise, type SessionExerciseInput,
} from "../services/api";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";
import { RetryErrorPanel } from "../components/composites/StatusPanel";
import { logger } from "../utils/logger";

type SetResult = {
  reps: string;
  weight_kg: string;
  duration_sec: string;
  distance_m: string;
  recorded_at?: string | null;
};
const metricNames = ["reps", "weight_kg", "duration_sec", "distance_m"] as const;
type MetricName = (typeof metricNames)[number];

const countSets = (exercise: SessionExercise) =>
  Math.max(1, Number(exercise.planned?.sets ?? 0), exercise.sets.length);

function existingResults(exercises: SessionExercise[]): Record<string, SetResult> {
  const result: Record<string, SetResult> = {};
  for (const exercise of exercises) {
    for (const set of exercise.sets.filter((item) => Boolean(item.recorded_at))) {
      result[`${exercise.id}:${set.order_index}`] = {
        reps: String(set.reps ?? ""),
        weight_kg: String(set.weight_kg ?? ""),
        duration_sec: String(set.duration_sec ?? ""),
        distance_m: String(set.distance_m ?? ""),
        recorded_at: set.recorded_at,
      };
    }
  }
  return result;
}

function buildPerformedExercises(
  exercises: SessionExercise[],
  results: Record<string, SetResult>,
): SessionExerciseInput[] {
  return exercises.map((exercise) => ({
    exercise_id: exercise.exercise_id ?? null,
    order: exercise.order_index,
    notes: exercise.notes ?? null,
    planned: exercise.planned ?? null,
    sets: Array.from({ length: countSets(exercise) }, (_, index) => {
      const row = results[`${exercise.id}:${index + 1}`];
      if (!row || !metricNames.some((name) => row[name].trim() !== "")) {
        return null;
      }
      const values = Object.fromEntries(metricNames.map((name) => [
        name, row[name].trim() === "" ? null : Number(row[name]),
      ])) as Record<MetricName, number | null>;
      return {
        order: index + 1,
        ...values,
        recorded_at: row.recorded_at ?? new Date().toISOString(),
      };
    }).filter((set): set is NonNullable<typeof set> => set !== null),
  }));
}

const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [results, setResults] = useState<Record<string, SetResult>>({});
  const sessionQuery = useQuery({
    queryKey: ["session-detail", id],
    queryFn: () => getSession(id!),
    enabled: Boolean(id),
  });
  const session = sessionQuery.data;
  useEffect(() => {
    if (session) {
      setResults(existingResults(session.exercises));
    }
  }, [session]);

  const performed = useMemo(
    () => session ? buildPerformedExercises(session.exercises, results) : [],
    [session, results],
  );
  const hasResults = performed.some((exercise) => (exercise.sets?.length ?? 0) > 0);

  const execute = async (mode: "start" | "reuse" | "save" | "finish") => {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      if (mode === "reuse") {
        const copy = await cloneSession(session.id, {
          planned_at: new Date().toISOString(),
          plan_id: null,
          include_actual: false,
        });
        await queryClient.invalidateQueries({ queryKey: ["calendar"] });
        navigate(`/sessions/${copy.id}`);
      } else if (mode === "start" && session.status === "planned") {
        await updateSession(session.id, { status: "in_progress" });
      } else if ((mode === "save" || mode === "finish") && session.status === "in_progress") {
        if (!hasResults) {
          setError(t("sessionDetail.requiresResults"));
          return;
        }
        await updateSession(session.id, {
          exercises: performed,
          ...(mode === "finish" ? { status: "completed" as const } : {}),
        });
        setSaved(mode === "save");
      }
      await queryClient.invalidateQueries({ queryKey: ["session-detail", session.id] });
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["home", "recent-sessions"] });
    } catch (cause) {
      setError(t("sessionDetail.saveError"));
      logger.apiError("Failed to update workout", cause, `/api/v1/sessions/${session.id}`, "PATCH");
    } finally {
      setBusy(false);
    }
  };

  const setValue = (exerciseId: string, index: number, metric: MetricName, value: string) => {
    const key = `${exerciseId}:${index}`;
    setResults((current) => ({
      ...current,
      [key]: {
        reps: "", weight_kg: "", duration_sec: "", distance_m: "",
        ...current[key],
        [metric]: value,
      },
    }));
  };
  const date = (value: string) => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value));
  const statusLabel = session?.status === "in_progress"
    ? t("sessionDetail.running")
    : session?.status === "completed"
      ? t("sessionDetail.complete")
      : t("sessionDetail.planned");

  return (
    <main className="training-page" aria-labelledby="session-detail-title">
      <h1 id="session-detail-title">{session?.title || t("sessionDetail.title")}</h1>
      {sessionQuery.isLoading ? <p role="status">{t("common.loading")}</p> : null}
      {sessionQuery.isError ? (
        <RetryErrorPanel
          message={t("sessionDetail.loadError")}
          retryLabel={t("actions.retry")}
          onRetry={() => void sessionQuery.refetch()}
          isRetrying={sessionQuery.isFetching}
        />
      ) : null}
      {error ? <div className="training-error" role="alert">{error}</div> : null}
      {saved ? <p role="status">{t("sessionDetail.saved")}</p> : null}
      {session ? (
        <>
          <TrainingPanel title={statusLabel} footer={
            <div className="workout-editor__bottom-actions">
              {session.status === "planned" ? (
                <Button disabled={busy} onClick={() => void execute("start")}>
                  {t("workoutEditor.actions.start")}
                </Button>
              ) : null}
              {session.status !== "canceled" ? (
                <Button variant="secondary" disabled={busy} onClick={() => void execute("reuse")}>
                  {t("sessionDetail.actions.reuse")}
                </Button>
              ) : null}
            </div>
          }>
            <p>{date(session.planned_at)}</p>
            {session.started_at ? <p>{t("sessionDetail.started")}: {date(session.started_at)}</p> : null}
            {session.notes ? <p>{session.notes}</p> : null}
          </TrainingPanel>
          <TrainingPanel
            title={t("sessionDetail.recording")}
            footer={session.status === "in_progress" ? (
              <div className="workout-editor__bottom-actions">
                <Button variant="secondary" disabled={busy || !hasResults}
                  onClick={() => void execute("save")}>
                  {t("sessionDetail.actions.save")}
                </Button>
                <Button disabled={busy || !hasResults} onClick={() => void execute("finish")}>
                  {t("sessionDetail.actions.finish")}
                </Button>
              </div>
            ) : undefined}
          >
            {session.exercises.length === 0 ? (
              <div className="training-empty">{t("sessionDetail.empty")}</div>
            ) : session.exercises.map((exercise) => (
              <div key={exercise.id} className="workout-editor__activity">
                <TrainingSummaryCard
                  title={exercise.exercise_name || t("workoutEditor.exerciseFallback")}
                  meta={t("workoutEditor.summary.sets", { count: countSets(exercise) })}
                />
                {Array.from({ length: countSets(exercise) }, (_, index) => {
                  const row = results[`${exercise.id}:${index + 1}`];
                  const planned = exercise.planned;
                  const showAll = !planned || [planned.reps, planned.load, planned.distance, planned.duration]
                    .every((value) => value == null);
                  const metrics: Array<[MetricName,string,boolean]> = [
                    ["reps", t("sessionDetail.reps"), showAll || planned?.reps != null],
                    ["weight_kg", t("sessionDetail.load"), showAll || planned?.load != null],
                    ["duration_sec", t("sessionDetail.duration"), showAll || planned?.duration != null],
                    ["distance_m", t("sessionDetail.distance"), showAll || planned?.distance != null],
                  ];
                  return <div key={index} className="workout-editor__general">
                    <strong>{t("sessionDetail.set", { number: index + 1 })}</strong>
                    {metrics.filter(([, , show]) => show).map(([metric, label]) => (
                      <label className="form-label" key={metric}>
                        <span className="form-label-text">{label}</span>
                        <InputControl type="number" min={0} step="any"
                          disabled={session.status !== "in_progress" || busy}
                          value={row?.[metric] ?? ""}
                          onChange={(event) => setValue(exercise.id, index + 1, metric, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>;
                })}
              </div>
            ))}
          </TrainingPanel>
        </>
      ) : null}
    </main>
  );
};
export default SessionDetail;
