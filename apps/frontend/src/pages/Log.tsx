import type React from "react";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { Button, IconButton, InputControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  createSession,
  type CreateSessionRequest,
  type SessionExerciseInput,
  type IntakeKind,
} from "../services/sessionApi";
import {
  ExercisePicker,
  useExerciseCatalog,
  type ExerciseOption,
} from "../components/composites/ExercisePicker";
import { FormFeedback } from "../components/composites/FormStack";
import { TrainingPanel } from "../components/composites/TrainingSurface";
import { TRAINING_DATA_CONFIG, TRAINING_TIME_UNITS } from "../config/trainingSurfaces";
import {
  EMPTY_SET_INPUTS,
  fieldFor,
  invalidMetric,
  isBlankSet,
  SET_METRIC_FIELDS,
  labelKeyFor,
  toMetricValues,
  type SetMetricInputs,
} from "../lib/forms/setMetrics";
import { apiErrorCode } from "../services/httpApi";
import { ResultNoteField } from "../components/domain/ResultNoteField";
import { INTAKE_KINDS, INTAKE_MAX_AMOUNT, parseIntakeAmount } from "../lib/sessions/intake";
import { useLoadUnit } from "../hooks/useLoadUnit";
import type { LoadUnit } from "../lib/units/load";
import { CALENDAR_QUERY_KEY } from "../lib/scheduling/calendarQuery";
import {
  localDateKey,
  localDateTimeToIso,
  localTimeKey,
  SESSION_DURATION_LIMITS,
} from "../lib/scheduling/sessionSchedule";

type LoggedSet = SetMetricInputs & { key: string };

type LoggedExercise = {
  key: string;
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
};

/** A workout of the default length that has just ended, rounded down to the duration step. */
function defaultStart(now = new Date()): Date {
  const stepMs = SESSION_DURATION_LIMITS.step * TRAINING_TIME_UNITS.millisecondsPerMinute;
  const start =
    now.getTime() -
    TRAINING_DATA_CONFIG.sessionDurationDefaultMinutes * TRAINING_TIME_UNITS.millisecondsPerMinute;
  return new Date(Math.floor(start / stepMs) * stepMs);
}

/** Filled sets become performed work; blank rows are left out (ADR-042). */
function toExerciseInputs(exercises: LoggedExercise[], loadUnit: LoadUnit): SessionExerciseInput[] {
  return exercises.map((exercise, index) => ({
    exercise_id: exercise.exerciseId,
    order: index + 1,
    sets: exercise.sets
      .filter((set) => !isBlankSet(set))
      .map((set, setIndex) => ({
        order: setIndex + 1,
        status: "completed" as const,
        ...toMetricValues(set, loadUnit),
      })),
  }));
}

/**
 * Manual Log (`/log`, US-5.1, issue 289): record a workout that already happened. The
 * whole workout is saved in one request as a completed session, so a failed save
 * leaves nothing behind. Points come from the server and show on the session
 * page that opens after saving.
 */
const Log: React.FC = () => {
  const { t } = useTranslation();
  const { unit: loadUnit, ready: loadUnitReady } = useLoadUnit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nextKey = useRef(0);
  const newKey = () => {
    nextKey.current += 1;
    return String(nextKey.current);
  };

  const [initialStart] = useState(defaultStart);
  const [name, setName] = useState("");
  const [day, setDay] = useState(() => localDateKey(initialStart));
  const [time, setTime] = useState(() => localTimeKey(initialStart));
  const [length, setLength] = useState(String(TRAINING_DATA_CONFIG.sessionDurationDefaultMinutes));
  const [resultNote, setResultNote] = useState("");
  // ADR-045: optional totals for the workout, saved as intake entries.
  const [intakeText, setIntakeText] = useState<Record<IntakeKind, string>>({
    water: "",
    energy: "",
  });
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const catalog = useExerciseCatalog({ enabled: true, source: "manual log" });

  const save = useMutation({
    mutationFn: (payload: CreateSessionRequest) => createSession(payload),
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CALENDAR_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["home", "recent-sessions"] }),
      ]);
      void navigate(`/sessions/${session.id}`);
    },
    onError: (error) => {
      setMessage(
        apiErrorCode(error) === "E.SESSION.LOG_IN_FUTURE"
          ? t("logSurface.errors.future")
          : t("logSurface.errors.save"),
      );
    },
  });

  const addExercise = (exercise: ExerciseOption) => {
    setExercises((current) => [
      ...current,
      {
        key: newKey(),
        exerciseId: exercise.id,
        name: exercise.name,
        sets: [{ key: newKey(), ...EMPTY_SET_INPUTS }],
      },
    ]);
    setMessage(null);
  };

  const updateExercise = (key: string, update: (exercise: LoggedExercise) => LoggedExercise) =>
    setExercises((current) => current.map((item) => (item.key === key ? update(item) : item)));

  const updateSet = (exerciseKey: string, setKey: string, patch: Partial<SetMetricInputs>) => {
    updateExercise(exerciseKey, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => (set.key === setKey ? { ...set, ...patch } : set)),
    }));
    setMessage(null);
  };

  // A new set starts from the previous one: consecutive sets are usually similar.
  const addSet = (exerciseKey: string) =>
    updateExercise(exerciseKey, (exercise) => {
      const previous = exercise.sets[exercise.sets.length - 1];
      const values: SetMetricInputs = { ...EMPTY_SET_INPUTS };
      for (const { metric } of SET_METRIC_FIELDS) {
        values[metric] = previous?.[metric] ?? "";
      }
      return { ...exercise, sets: [...exercise.sets, { key: newKey(), ...values }] };
    });

  const removeSet = (exerciseKey: string, setKey: string) =>
    updateExercise(exerciseKey, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => set.key !== setKey),
    }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (save.isPending) {
      return;
    }
    const start = localDateTimeToIso(day, time);
    if (!start) {
      setMessage(t("calendarSurface.schedule.errors.invalid"));
      return;
    }
    if (new Date(start).getTime() > Date.now()) {
      setMessage(t("logSurface.errors.future"));
      return;
    }
    const minutes = Number(length);
    if (
      !Number.isInteger(minutes) ||
      minutes < SESSION_DURATION_LIMITS.min ||
      minutes > SESSION_DURATION_LIMITS.max
    ) {
      setMessage(
        t("calendarSurface.schedule.errors.invalidDuration", {
          min: SESSION_DURATION_LIMITS.min,
          max: SESSION_DURATION_LIMITS.max,
        }),
      );
      return;
    }
    const intake: { kind: IntakeKind; amount: number }[] = [];
    for (const kind of INTAKE_KINDS) {
      if (!intakeText[kind].trim()) {
        continue;
      }
      const amount = parseIntakeAmount(kind, intakeText[kind]);
      if (amount === null) {
        setMessage(t(`workoutIntake.invalid.${kind}`, { max: INTAKE_MAX_AMOUNT[kind] }));
        return;
      }
      intake.push({ kind, amount });
    }
    if (exercises.length === 0) {
      setMessage(t("logSurface.errors.noExercises"));
      return;
    }
    for (const exercise of exercises) {
      for (const [index, set] of exercise.sets.entries()) {
        const metric = invalidMetric(set);
        if (metric) {
          setMessage(
            t("logSurface.errors.invalidSet", {
              exercise: exercise.name,
              number: index + 1,
              field: t(labelKeyFor(fieldFor(metric), loadUnit)),
            }),
          );
          return;
        }
      }
    }

    setMessage(null);
    save.mutate({
      status: "completed",
      title: name.trim() || null,
      planned_at: start,
      planned_duration_min: minutes,
      // A logged workout is already done, so its note is a post-workout note (ADR-044).
      result_note: resultNote.trim() || null,
      ...(intake.length > 0 ? { intake } : {}),
      visibility: "private",
      exercises: toExerciseInputs(exercises, loadUnit),
    });
  };

  const busy = save.isPending;

  return (
    <main className="training-page" aria-labelledby="log-title" data-app-surface="log">
      <h1 id="log-title">{t("logSurface.title")}</h1>

      <form className="training-grid log-surface__grid" noValidate onSubmit={submit}>
        <TrainingPanel title={t("logSurface.sections.workout")} className="log-surface__details">
          <label className="form-label">
            <span className="form-label-text">{t("workoutEditor.fields.name")}</span>
            <InputControl
              value={name}
              maxLength={100}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="log-surface__when">
            <label className="form-label">
              <span className="form-label-text">{t("calendarSurface.schedule.fields.day")}</span>
              <InputControl
                type="date"
                value={day}
                max={localDateKey(new Date())}
                required
                disabled={busy}
                onChange={(event) => {
                  setDay(event.target.value);
                  setMessage(null);
                }}
              />
            </label>
            <label className="form-label">
              <span className="form-label-text">{t("logSurface.fields.startTime")}</span>
              <InputControl
                type="time"
                value={time}
                required
                disabled={busy}
                onChange={(event) => {
                  setTime(event.target.value);
                  setMessage(null);
                }}
              />
            </label>
            <label className="form-label">
              <span className="form-label-text">
                {t("calendarSurface.schedule.fields.duration")}
              </span>
              <InputControl
                type="number"
                inputMode="numeric"
                min={SESSION_DURATION_LIMITS.min}
                max={SESSION_DURATION_LIMITS.max}
                step={1}
                value={length}
                required
                disabled={busy}
                onChange={(event) => {
                  setLength(event.target.value);
                  setMessage(null);
                }}
              />
            </label>
          </div>
          <ResultNoteField value={resultNote} onChange={setResultNote} disabled={busy} />
          <div className="set-fields">
            {INTAKE_KINDS.map((kind) => (
              <label key={kind} className="form-label">
                <span className="form-label-text">{t(`workoutIntake.fields.total.${kind}`)}</span>
                <InputControl
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={INTAKE_MAX_AMOUNT[kind]}
                  step={1}
                  value={intakeText[kind]}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIntakeText((current) => ({ ...current, [kind]: value }));
                    setMessage(null);
                  }}
                />
              </label>
            ))}
          </div>
          {message ? <FormFeedback tone="warning">{message}</FormFeedback> : null}
          <Button type="submit" isLoading={busy}>
            {t("logSurface.actions.save")}
          </Button>
        </TrainingPanel>

        <TrainingPanel
          title={t("logSurface.sections.exercises")}
          className="log-surface__exercises"
        >
          <ExercisePicker catalog={catalog} disabled={busy} onAdd={addExercise} />

          {exercises.length === 0 ? (
            <div className="training-empty">{t("logSurface.empty")}</div>
          ) : (
            <ol className="stack-list">
              {exercises.map((exercise) => (
                <li key={exercise.key} className="log-exercise">
                  <div className="log-exercise__header">
                    <h4>{exercise.name}</h4>
                    <IconButton
                      type="button"
                      icon={<X />}
                      label={t("logSurface.actions.removeExercise", { name: exercise.name })}
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setExercises((current) =>
                          current.filter((item) => item.key !== exercise.key),
                        )
                      }
                    />
                  </div>
                  {exercise.sets.map((set, index) => (
                    <fieldset key={set.key} className="log-set" disabled={busy}>
                      <legend>{t("sessionDetail.set", { number: index + 1 })}</legend>
                      <div className="set-fields">
                        {SET_METRIC_FIELDS.map((field) => (
                          <label key={field.metric} className="form-label">
                            <span className="form-label-text">
                              {t(labelKeyFor(field, loadUnit))}
                            </span>
                            <InputControl
                              type="number"
                              inputMode={field.integer ? "numeric" : "decimal"}
                              min={field.min}
                              max={field.max}
                              step={field.integer ? 1 : "any"}
                              value={set[field.metric]}
                              // Load waits for the unit, so it is never read in the other one.
                              disabled={field.metric === "weight_kg" && !loadUnitReady}
                              onChange={(event) =>
                                updateSet(exercise.key, set.key, {
                                  [field.metric]: event.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <IconButton
                        type="button"
                        icon={<Minus />}
                        label={t("logSurface.actions.removeSet", {
                          number: index + 1,
                          name: exercise.name,
                        })}
                        variant="ghost"
                        onClick={() => removeSet(exercise.key, set.key)}
                      />
                    </fieldset>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Plus aria-hidden="true" />}
                    disabled={busy}
                    onClick={() => addSet(exercise.key)}
                  >
                    {t("logSurface.actions.addSet")}
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </TrainingPanel>
      </form>
    </main>
  );
};

export default Log;
