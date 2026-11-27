import React, { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pause, Play, Plus } from "lucide-react";
import { Button, InputControl, MetricCard } from "@fitvibe/ui";
import type { TFunction } from "i18next";
import { TrainingPanel, TrainingSummaryCard } from "../components/composites/TrainingSurface";
import { RetryErrorPanel, StatusPanel } from "../components/composites/StatusPanel";
import { FormActions, FormFeedback, FormStack } from "../components/composites/FormStack";
import { Modal } from "../components/composites/Modal";
import { ExercisePicker, useExerciseCatalog } from "../components/composites/ExercisePicker";
import { useClock } from "../hooks/useClock";
import {
  activeSeconds,
  currentPosition,
  elapsedSeconds,
  fieldsFor,
  formatClock,
  nextPosition,
  restRemaining,
  summarize,
  type LivePosition,
} from "../lib/execution/liveWorkout";
import {
  useLiveWorkout,
  type FinishChoice,
  type LiveCommand,
} from "../lib/execution/useLiveWorkout";
import {
  fieldFor,
  invalidMetric,
  labelKeyFor,
  pickTargetValues,
  toMetricInputs,
  toMetricValues,
  type SetMetricInputs,
  type SetMetricValues,
} from "../lib/forms/setMetrics";
import { useLoadUnit } from "../hooks/useLoadUnit";
import type { LoadUnit } from "../lib/units/load";
import { setSummary, valuesSummary } from "../lib/sessions/setSummary";
import { apiErrorCode } from "../services/httpApi";
import type {
  SessionExercise,
  SessionSetPlannedValues,
  SessionWithExercises,
} from "../services/sessionApi";

const SET_META_KEYS = {
  planned: "sessionDetail.prescription",
  completed: "sessionDetail.actual",
  skipped: "sessionDetail.skipped",
} as const;

const exerciseName = (t: TFunction, exercise: SessionExercise) =>
  exercise.exercise_name || t("workoutEditor.exerciseFallback");

/** A new set starts from the last one's target, or from what was done in it. */
function plannedFromLast(exercise: SessionExercise): SessionSetPlannedValues | null {
  const last = exercise.sets[exercise.sets.length - 1];
  if (!last) {
    return null;
  }
  if (last.planned) {
    return last.planned;
  }
  if (last.status !== "completed") {
    return null;
  }
  return { ...pickTargetValues(last), rest_sec: last.rest_sec ?? null };
}

const errorMessageKey = (error: unknown) =>
  apiErrorCode(error) === "E.SESSION.NOT_ACTIVE"
    ? "liveWorkout.errors.notActive"
    : "liveWorkout.errors.save";

type CurrentSetProps = {
  position: LivePosition;
  loadUnit: LoadUnit;
  disabled: boolean;
  /** Values to complete the set with (load in kilograms), or null to skip it. */
  onRecord: (values: SetMetricValues | null) => void;
};

/** The set to do now: its target, the values to record, and Complete or Skip. */
const CurrentSet: React.FC<CurrentSetProps> = ({ position, loadUnit, disabled, onRecord }) => {
  const { t } = useTranslation();
  const { set, exercise, setNumber, setCount } = position;
  // Keyed by set id and unit in the parent, so the fields start from this set's target.
  const [inputs, setInputs] = useState<SetMetricInputs>(() =>
    toMetricInputs(set.planned, loadUnit),
  );
  const [message, setMessage] = useState<string | null>(null);
  const fields = fieldsFor(set);
  const target = valuesSummary(t, set.planned, loadUnit);

  const complete = (event: React.FormEvent) => {
    event.preventDefault();
    const metric = invalidMetric(inputs, fields);
    if (metric) {
      setMessage(
        t("liveWorkout.errors.invalidSet", { field: t(labelKeyFor(fieldFor(metric), loadUnit)) }),
      );
      return;
    }
    setMessage(null);
    onRecord(toMetricValues(inputs, loadUnit));
  };

  return (
    <FormStack className="live-set" noValidate onSubmit={complete} aria-labelledby="live-set-title">
      <div className="live-set__heading">
        <h2 id="live-set-title" className="typography-section-title">
          {exerciseName(t, exercise)}
        </h2>
        <p className="text-secondary">
          {t("liveWorkout.current.setOf", { number: setNumber, count: setCount })}
        </p>
      </div>
      <p className="live-set__target text-secondary">
        {target
          ? t("liveWorkout.current.target", { value: target })
          : t("liveWorkout.current.noTarget")}
      </p>
      <fieldset className="set-fields" disabled={disabled}>
        <legend className="sr-only">{t("liveWorkout.current.values")}</legend>
        {fields.map((field) => (
          <label key={field.metric} className="form-label">
            <span className="form-label-text">{t(labelKeyFor(field, loadUnit))}</span>
            <InputControl
              type="number"
              inputMode={field.integer ? "numeric" : "decimal"}
              min={field.min}
              max={field.max}
              step={field.integer ? 1 : "any"}
              value={inputs[field.metric]}
              onChange={(event) => {
                setInputs((current) => ({ ...current, [field.metric]: event.target.value }));
                setMessage(null);
              }}
            />
          </label>
        ))}
      </fieldset>
      {message ? <FormFeedback tone="warning">{message}</FormFeedback> : null}
      <FormActions>
        <Button type="submit" disabled={disabled}>
          {t("liveWorkout.actions.completeSet")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => onRecord(null)}
        >
          {t("liveWorkout.actions.skipSet")}
        </Button>
      </FormActions>
    </FormStack>
  );
};

type FinishDialogProps = {
  open: boolean;
  session: SessionWithExercises;
  busy: boolean;
  error: string | null;
  onChoose: (choice: FinishChoice) => void;
  onClose: () => void;
};

/** Save as completed, save as stopped early, or discard after a second confirmation. */
const FinishDialog: React.FC<FinishDialogProps> = ({
  open,
  session,
  busy,
  error,
  onChoose,
  onClose,
}) => {
  const { t } = useTranslation();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const summary = summarize(session);
  const close = () => {
    setConfirmDiscard(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={confirmDiscard ? t("liveWorkout.finish.discardTitle") : t("liveWorkout.finish.title")}
      onClose={busy ? undefined : close}
      closeOnBackdrop={!busy}
      width="sm"
      footer={
        confirmDiscard ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmDiscard(false)}>
              {t("liveWorkout.actions.keepWorkout")}
            </Button>
            <Button variant="danger" isLoading={busy} onClick={() => onChoose({ kind: "discard" })}>
              {t("liveWorkout.actions.confirmDiscard")}
            </Button>
          </>
        ) : (
          <FormActions>
            <Button
              isLoading={busy}
              onClick={() => onChoose({ kind: "save", outcome: "completed" })}
            >
              {t("liveWorkout.actions.saveCompleted")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onChoose({ kind: "save", outcome: "stopped_early" })}
            >
              {t("liveWorkout.actions.saveStoppedEarly")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmDiscard(true)}>
              {t("liveWorkout.actions.discard")}
            </Button>
          </FormActions>
        )
      }
    >
      <FormStack as="div" className="live-finish">
        {error ? <FormFeedback tone="danger">{error}</FormFeedback> : null}
        {confirmDiscard ? (
          <p>{t("liveWorkout.finish.discardWarning")}</p>
        ) : (
          <>
            <div className="metric-card-grid">
              <MetricCard label={t("liveWorkout.finish.done")} value={summary.completedSets} />
              <MetricCard label={t("liveWorkout.finish.skipped")} value={summary.skippedSets} />
              <MetricCard label={t("liveWorkout.finish.remaining")} value={summary.remainingSets} />
            </div>
            <p>{t("liveWorkout.finish.scoring")}</p>
          </>
        )}
      </FormStack>
    </Modal>
  );
};

/**
 * Live workout (`/start/:id`, issue 365, ADR-043): record each set as it happens.
 * The server stores every change at once, so a reload or another device picks up
 * where the athlete left off. Timers come from the stored timestamps.
 */
const LiveWorkout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { query, command, finish } = useLiveWorkout(id);
  const [finishing, setFinishing] = useState(false);
  const session = query.data;
  const active = session?.status === "in_progress";
  const paused = Boolean(session?.paused_at);
  const now = useClock(active);
  const catalog = useExerciseCatalog({ enabled: active, source: "live workout" });
  const { unit: loadUnit, ready: loadUnitReady } = useLoadUnit();

  const run = (input: LiveCommand) => {
    if (!command.isPending) {
      command.mutate(input);
    }
  };

  const chooseFinish = (choice: FinishChoice) =>
    finish.mutate(choice, {
      onSuccess: () => {
        setFinishing(false);
        void navigate(choice.kind === "discard" ? "/" : `/sessions/${id}`);
      },
    });

  if (query.isLoading) {
    return (
      <main className="training-page" aria-labelledby="live-title" data-app-surface="live-workout">
        <h1 id="live-title">{t("liveWorkout.title")}</h1>
        <StatusPanel kind="loading">{t("loading.app")}</StatusPanel>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="training-page" aria-labelledby="live-title" data-app-surface="live-workout">
        <h1 id="live-title">{t("liveWorkout.title")}</h1>
        <RetryErrorPanel
          message={t("sessionDetail.loadError")}
          retryLabel={t("actions.retry")}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      </main>
    );
  }

  // A finished or canceled workout is read on its own page.
  if (session.status === "completed" || session.status === "canceled") {
    return <Navigate to={`/sessions/${session.id}`} replace />;
  }

  const title = session.title || t("liveWorkout.title");
  const position = active ? currentPosition(session) : null;
  const next = active ? nextPosition(session) : null;
  const rest = active && !paused ? restRemaining(session, now) : 0;
  const busy = command.isPending || finish.isPending;

  return (
    <main className="training-page" aria-labelledby="live-title" data-app-surface="live-workout">
      <h1 id="live-title">{title}</h1>

      {session.status === "planned" ? (
        <TrainingPanel title={t("sessionDetail.planned")}>
          <p>{t("liveWorkout.notStarted")}</p>
          <Button isLoading={command.isPending} onClick={() => run({ kind: "start" })}>
            {t("workoutEditor.actions.start")}
          </Button>
          {command.isError ? (
            <FormFeedback tone="danger">{t(errorMessageKey(command.error))}</FormFeedback>
          ) : null}
        </TrainingPanel>
      ) : (
        <>
          <section
            className="live-clock"
            data-state={paused ? "paused" : "running"}
            aria-label={t("liveWorkout.clock.label")}
          >
            <div className="live-clock__primary">
              <span className="typography-supporting text-secondary">
                {paused ? t("liveWorkout.clock.paused") : t("liveWorkout.clock.active")}
              </span>
              <span className="live-clock__value" role="timer">
                {formatClock(activeSeconds(session, now))}
              </span>
            </div>
            <div className="live-clock__secondary">
              <span className="typography-supporting text-secondary">
                {t("liveWorkout.clock.elapsed")}
              </span>
              <span className="live-clock__value live-clock__value--small" role="timer">
                {formatClock(elapsedSeconds(session, now))}
              </span>
            </div>
            <div className="live-clock__actions">
              <Button
                variant="secondary"
                leadingIcon={paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                disabled={busy}
                onClick={() => run({ kind: paused ? "resume" : "pause" })}
              >
                {paused ? t("liveWorkout.actions.resume") : t("liveWorkout.actions.pause")}
              </Button>
              <Button disabled={busy} onClick={() => setFinishing(true)}>
                {t("liveWorkout.actions.finish")}
              </Button>
            </div>
          </section>

          {command.isError ? (
            <FormFeedback tone="danger">{t(errorMessageKey(command.error))}</FormFeedback>
          ) : null}

          <div className="training-grid live-surface__grid">
            <TrainingPanel
              title={t("liveWorkout.current.title")}
              status={paused ? "warning" : "success"}
              className="live-surface__current"
            >
              {paused ? (
                <FormFeedback tone="info">{t("liveWorkout.pausedNotice")}</FormFeedback>
              ) : null}
              {rest > 0 ? (
                <p className="live-rest">
                  <span>{t("liveWorkout.rest")}</span>
                  <span className="live-rest__value" role="timer">
                    {formatClock(rest)}
                  </span>
                </p>
              ) : null}
              {position ? (
                <CurrentSet
                  key={`${position.set.id}:${loadUnit}`}
                  position={position}
                  loadUnit={loadUnit}
                  disabled={busy || paused || !loadUnitReady}
                  onRecord={(values) =>
                    run({
                      kind: "record",
                      setId: position.set.id,
                      payload: values ? { status: "completed", ...values } : { status: "skipped" },
                    })
                  }
                />
              ) : (
                <div className="training-empty">{t("liveWorkout.current.done")}</div>
              )}
              {next ? (
                <p className="live-set__next text-secondary">
                  {t("liveWorkout.current.next", {
                    name: exerciseName(t, next.exercise),
                    number: next.setNumber,
                  })}
                </p>
              ) : null}
            </TrainingPanel>

            <TrainingPanel title={t("liveWorkout.outline.title")} className="live-surface__outline">
              <ol className="stack-list">
                {session.exercises.map((exercise) => {
                  const name = exerciseName(t, exercise);
                  const skipped = exercise.status === "skipped";
                  const hasOpenSets = exercise.sets.some((set) => set.status === "planned");
                  return (
                    <li key={exercise.id} className="live-outline__exercise" data-skipped={skipped}>
                      <div className="live-outline__header">
                        <h3 className="typography-card-title">{name}</h3>
                        {skipped ? (
                          <span className="typography-supporting text-secondary">
                            {t("sessionDetail.skipped")}
                          </span>
                        ) : null}
                      </div>
                      {exercise.sets.map((set, index) => (
                        <TrainingSummaryCard
                          key={set.id}
                          title={t("sessionDetail.set", { number: index + 1 })}
                          meta={t(SET_META_KEYS[set.status])}
                          supporting={setSummary(t, set, loadUnit)}
                          className={
                            set.id === position?.set.id ? "live-outline__set--current" : undefined
                          }
                        />
                      ))}
                      <FormActions>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          leadingIcon={<Plus aria-hidden="true" />}
                          disabled={busy}
                          aria-label={t("liveWorkout.actions.addSetTo", { name })}
                          onClick={() =>
                            run({
                              kind: "addSet",
                              exerciseRowId: exercise.id,
                              planned: plannedFromLast(exercise),
                            })
                          }
                        >
                          {t("logSurface.actions.addSet")}
                        </Button>
                        {!skipped && hasOpenSets ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run({ kind: "skipExercise", exerciseRowId: exercise.id })
                            }
                          >
                            {t("liveWorkout.actions.skipExercise", { name })}
                          </Button>
                        ) : null}
                      </FormActions>
                    </li>
                  );
                })}
              </ol>
              <ExercisePicker
                catalog={catalog}
                disabled={busy}
                onAdd={(exercise) => {
                  run({ kind: "addExercise", exerciseId: exercise.id });
                  catalog.reset();
                }}
              />
            </TrainingPanel>
          </div>

          <FinishDialog
            open={finishing}
            session={session}
            busy={finish.isPending}
            error={finish.isError ? t(errorMessageKey(finish.error)) : null}
            onChoose={chooseFinish}
            onClose={() => {
              finish.reset();
              setFinishing(false);
            }}
          />
        </>
      )}
    </main>
  );
};

export default LiveWorkout;
