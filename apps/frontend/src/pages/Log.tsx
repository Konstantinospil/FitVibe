import React, { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Minus, Plus, X } from "lucide-react";
import { Button, IconButton, InputControl, TextareaControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  createSession,
  type CreateSessionRequest,
  type SessionExerciseInput,
} from "../services/sessionApi";
import {
  ExercisePicker,
  useExerciseCatalog,
  type ExerciseOption,
} from "../components/composites/ExercisePicker";
import { FormFeedback } from "../components/composites/FormStack";
import { TrainingPanel } from "../components/composites/TrainingSurface";
import { TRAINING_DATA_CONFIG, TRAINING_TIME_UNITS } from "../config/trainingSurfaces";
import { optionalNonNegativeNumber } from "../lib/forms/numberInput";
import { CALENDAR_QUERY_KEY } from "../lib/scheduling/calendarQuery";
import {
  localDateKey,
  localDateTimeToIso,
  localTimeKey,
  SESSION_DURATION_LIMITS,
} from "../lib/scheduling/sessionSchedule";

type SetValues = {
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  rpe: string;
};

type LoggedSet = SetValues & { key: string };

type LoggedExercise = {
  key: string;
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
};

const SET_FIELDS: ReadonlyArray<{
  field: keyof SetValues;
  label: string;
  integer: boolean;
  max?: number;
}> = [
  { field: "reps", label: "workoutEditor.fields.repetitions", integer: true },
  { field: "weight", label: "logSurface.fields.weight", integer: false },
  { field: "duration", label: "workoutEditor.fields.duration", integer: true },
  { field: "distance", label: "logSurface.fields.distance", integer: true },
  { field: "rpe", label: "logSurface.fields.rpe", integer: true, max: 10 },
];

const EMPTY_SET: SetValues = { reps: "", weight: "", duration: "", distance: "", rpe: "" };

/** A workout of the default length that has just ended, rounded down to the duration step. */
function defaultStart(now = new Date()): Date {
  const stepMs = SESSION_DURATION_LIMITS.step * TRAINING_TIME_UNITS.millisecondsPerMinute;
  const start =
    now.getTime() -
    TRAINING_DATA_CONFIG.sessionDurationDefaultMinutes * TRAINING_TIME_UNITS.millisecondsPerMinute;
  return new Date(Math.floor(start / stepMs) * stepMs);
}

const isBlank = (set: SetValues) => SET_FIELDS.every(({ field }) => !set[field].trim());

/** A set field is invalid when it is filled but not a whole number where one is required. */
function invalidField(set: SetValues): keyof SetValues | null {
  for (const { field, integer, max } of SET_FIELDS) {
    if (!set[field].trim()) {
      continue;
    }
    const value = optionalNonNegativeNumber(set[field]);
    const outOfRange =
      value === null ||
      (integer && !Number.isInteger(value)) ||
      (max !== undefined && value > max) ||
      (field === "rpe" && value < 1);
    if (outOfRange) {
      return field;
    }
  }
  return null;
}

/** Filled sets become performed work; blank rows are left out (ADR-042). */
function toExerciseInputs(exercises: LoggedExercise[]): SessionExerciseInput[] {
  return exercises.map((exercise, index) => ({
    exercise_id: exercise.exerciseId,
    order: index + 1,
    sets: exercise.sets
      .filter((set) => !isBlank(set))
      .map((set, setIndex) => ({
        order: setIndex + 1,
        status: "completed" as const,
        reps: optionalNonNegativeNumber(set.reps),
        weight_kg: optionalNonNegativeNumber(set.weight),
        duration_sec: optionalNonNegativeNumber(set.duration),
        distance_m: optionalNonNegativeNumber(set.distance),
        rpe: optionalNonNegativeNumber(set.rpe),
      })),
  }));
}

function errorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  const body: unknown = error.response?.data;
  const code = (body as { error?: { code?: unknown } } | undefined)?.error?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Manual Log (`/log`, US-5.1, issue 289): record a workout that already happened. The
 * whole workout is saved in one request as a completed session, so a failed save
 * leaves nothing behind. Points come from the server and show on the session
 * page that opens after saving.
 */
const Log: React.FC = () => {
  const { t } = useTranslation();
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
  const [notes, setNotes] = useState("");
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
        errorCode(error) === "E.SESSION.LOG_IN_FUTURE"
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
        sets: [{ key: newKey(), ...EMPTY_SET }],
      },
    ]);
    setMessage(null);
  };

  const updateExercise = (key: string, update: (exercise: LoggedExercise) => LoggedExercise) =>
    setExercises((current) => current.map((item) => (item.key === key ? update(item) : item)));

  const updateSet = (exerciseKey: string, setKey: string, patch: Partial<SetValues>) => {
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
      const values: SetValues = previous
        ? {
            reps: previous.reps,
            weight: previous.weight,
            duration: previous.duration,
            distance: previous.distance,
            rpe: previous.rpe,
          }
        : EMPTY_SET;
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
    if (exercises.length === 0) {
      setMessage(t("logSurface.errors.noExercises"));
      return;
    }
    for (const exercise of exercises) {
      for (const [index, set] of exercise.sets.entries()) {
        const field = invalidField(set);
        if (field) {
          setMessage(
            t("logSurface.errors.invalidSet", {
              exercise: exercise.name,
              number: index + 1,
              field: t(SET_FIELDS.find((item) => item.field === field)!.label),
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
      notes: notes.trim() || null,
      visibility: "private",
      exercises: toExerciseInputs(exercises),
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
          <label className="form-label">
            <span className="form-label-text">{t("workoutEditor.fields.notes")}</span>
            <TextareaControl
              value={notes}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
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
            <ol className="log-surface__exercise-list">
              {exercises.map((exercise) => (
                <li key={exercise.key} className="log-exercise">
                  <div className="log-exercise__header">
                    <h4>{exercise.name}</h4>
                    <IconButton
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
                      <div className="log-set__fields">
                        {SET_FIELDS.map(({ field, label, integer, max }) => (
                          <label key={field} className="form-label">
                            <span className="form-label-text">{t(label)}</span>
                            <InputControl
                              type="number"
                              inputMode={integer ? "numeric" : "decimal"}
                              min={field === "rpe" ? 1 : 0}
                              max={max}
                              step={integer ? 1 : "any"}
                              value={set[field]}
                              onChange={(event) =>
                                updateSet(exercise.key, set.key, { [field]: event.target.value })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <IconButton
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
