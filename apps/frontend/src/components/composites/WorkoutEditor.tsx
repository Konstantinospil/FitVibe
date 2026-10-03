import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Minus, Play, Plus, Search } from "lucide-react";
import {
  BUTTON_ICON_SIZES,
  Button,
  IconButton,
  InputControl,
  SelectControl,
  TextareaControl,
} from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  createSession,
  listExercises,
  updateSession,
  type SessionExerciseInput,
  type SessionWithExercises,
} from "../../services/api";
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import { logger } from "../../utils/logger";
import { Modal } from "./Modal";
import { RetryErrorPanel } from "./StatusPanel";
import { TrainingPanel, TrainingSummaryCard } from "./TrainingSurface";

export type WorkoutExerciseDraft = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  repetitions: string;
  weight: string;
  duration: string;
  targetExertion: string;
  restSet: string;
  restExercise: string;
};

export type WorkoutDraft = {
  name: string;
  notes: string;
  exercises: WorkoutExerciseDraft[];
};

export type WorkoutEditorAction = "plan" | "start";

export type WorkoutEditorProps = {
  open: boolean;
  onClose: () => void;
  session?: SessionWithExercises | null;
  plannedAt?: string;
  actions?: readonly WorkoutEditorAction[];
  onSaved?: (session: SessionWithExercises) => void;
};

type PersistMode = WorkoutEditorAction;

const optionalNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const toDraftExercise = (
  sessionExercise: SessionWithExercises["exercises"][number],
  name: string,
): WorkoutExerciseDraft => ({
  id: sessionExercise.id,
  exerciseId: sessionExercise.exercise_id ?? "",
  name,
  sets: sessionExercise.sets.length || sessionExercise.planned?.sets || 1,
  repetitions: String(sessionExercise.planned?.reps ?? sessionExercise.sets[0]?.reps ?? ""),
  weight: String(sessionExercise.planned?.load ?? sessionExercise.sets[0]?.weight_kg ?? ""),
  duration: String(sessionExercise.sets[0]?.duration_sec ?? ""),
  targetExertion: String(sessionExercise.planned?.rpe ?? sessionExercise.sets[0]?.rpe ?? ""),
  restSet: String(sessionExercise.sets[0]?.rest_sec ?? ""),
  restExercise: String(
    typeof sessionExercise.planned?.extras?.rest_after_exercise_sec === "number"
      ? sessionExercise.planned.extras.rest_after_exercise_sec
      : "",
  ),
});

const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  open,
  onClose,
  session = null,
  plannedAt,
  actions = ["start", "plan"],
  onSaved,
}) => {
  const { t } = useTranslation();
  const nextDraftId = useRef(0);
  const exercises = useQuery({
    queryKey: ["workout-editor", "exercises"],
    queryFn: () =>
      listExercises({
        limit: TRAINING_DATA_CONFIG.exerciseCatalogLimit,
      }),
    staleTime: TRAINING_DATA_CONFIG.exerciseCatalogStaleMs,
    enabled: open,
  });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>([]);
  const [persisting, setPersisting] = useState<PersistMode | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const exerciseNames = useMemo(
    () => new Map((exercises.data?.data ?? []).map((exercise) => [exercise.id, exercise.name])),
    [exercises.data],
  );
  const exerciseFallbackName = t("workoutEditor.exerciseFallback");

  useEffect(() => {
    if (!open) {
      return;
    }

    setSaveError(null);
    setSelectedExerciseId("");

    if (!session) {
      setName("");
      setNotes("");
      setDrafts([]);
      return;
    }

    setName(session.title ?? "");
    setNotes(session.notes ?? "");
    setDrafts(
      session.exercises
        .filter((exercise) => Boolean(exercise.exercise_id))
        .map((exercise) => toDraftExercise(exercise, exerciseFallbackName)),
    );
  }, [exerciseFallbackName, open, session]);

  useEffect(() => {
    if (!open || !session || exerciseNames.size === 0) {
      return;
    }

    setDrafts((current) => {
      let changed = false;
      const next = current.map((draft) => {
        const resolvedName = exerciseNames.get(draft.exerciseId);
        if (!resolvedName || resolvedName === draft.name) {
          return draft;
        }
        changed = true;
        return { ...draft, name: resolvedName };
      });
      return changed ? next : current;
    });
  }, [exerciseNames, open, session]);

  useEffect(() => {
    if (exercises.error) {
      logger.apiError(
        "Failed to load workout editor exercises",
        exercises.error,
        "/api/v1/exercises",
        "GET",
      );
    }
  }, [exercises.error]);

  const selectedExercise = exercises.data?.data.find((item) => item.id === selectedExerciseId);

  const addExercise = () => {
    if (!selectedExercise) {
      return;
    }

    nextDraftId.current += 1;
    const draft: WorkoutExerciseDraft = {
      id: `${selectedExercise.id}-${nextDraftId.current}`,
      exerciseId: selectedExercise.id,
      name: selectedExercise.name,
      sets: 1,
      repetitions: "",
      weight: "",
      duration: "",
      targetExertion: "",
      restSet: "",
      restExercise: "",
    };

    setDrafts((current) => [...current, draft]);
  };

  const updateDraft = (id: string, patch: Partial<WorkoutExerciseDraft>) => {
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const toSessionExercise = (
    exercise: WorkoutExerciseDraft,
    order: number,
  ): SessionExerciseInput => {
    const repetitions = optionalNumber(exercise.repetitions);
    const weight = optionalNumber(exercise.weight);
    const duration = optionalNumber(exercise.duration);
    const exertion = optionalNumber(exercise.targetExertion);
    const restSet = optionalNumber(exercise.restSet);
    const restExercise = optionalNumber(exercise.restExercise);

    return {
      exercise_id: exercise.exerciseId,
      order,
      planned: {
        sets: exercise.sets,
        reps: repetitions,
        load: weight,
        rpe: exertion,
        extras: restExercise === null ? undefined : { rest_after_exercise_sec: restExercise },
      },
      sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
        order: setIndex + 1,
        reps: repetitions,
        weight_kg: weight,
        duration_sec: duration,
        rpe: exertion,
        rest_sec: restSet,
      })),
    };
  };

  const persist = async (mode: PersistMode) => {
    if (persisting || drafts.length === 0) {
      return;
    }

    setPersisting(mode);
    setSaveError(null);

    const resolvedPlannedAt = session?.planned_at ?? plannedAt ?? new Date().toISOString();
    const exercisesPayload = drafts.map(toSessionExercise);

    try {
      const saved = session
        ? await updateSession(session.id, {
            title: name.trim() || null,
            notes: notes.trim() || null,
            planned_at: resolvedPlannedAt,
            status: mode === "start" ? "in_progress" : "planned",
            started_at: mode === "start" ? (session.started_at ?? new Date().toISOString()) : null,
            exercises: exercisesPayload,
          })
        : await createSession({
            title: name.trim() || null,
            notes: notes.trim() || null,
            planned_at: resolvedPlannedAt,
            visibility: "private",
            exercises: exercisesPayload,
          });

      const resolved =
        mode === "start" && !session
          ? await updateSession(saved.id, {
              status: "in_progress",
              started_at: new Date().toISOString(),
            })
          : saved;

      onSaved?.(resolved);
      onClose();
    } catch (error) {
      setSaveError(t("workoutEditor.errors.save"));
      logger.apiError(
        "Failed to persist workout editor session",
        error,
        session ? `/api/v1/sessions/${session.id}` : "/api/v1/sessions",
        session ? "PATCH" : "POST",
      );
    } finally {
      setPersisting(null);
    }
  };

  const active = drafts[drafts.length - 1];
  const isBusy = persisting !== null;
  const canStart = actions.includes("start");
  const canPlan = actions.includes("plan");

  return (
    <Modal
      open={open}
      title={t("workoutEditor.title")}
      closeLabel={t("workoutEditor.close")}
      onClose={onClose}
      closeOnBackdrop={!isBusy}
      width="lg"
      footer={
        <div className="workout-editor__bottom-actions">
          {canStart ? (
            <Button
              variant="secondary"
              size="lg"
              leadingIcon={<Play />}
              fullWidth
              disabled={drafts.length === 0 || isBusy}
              isLoading={persisting === "start"}
              onClick={() => {
                void persist("start");
              }}
            >
              {t("workoutEditor.actions.start")}
            </Button>
          ) : null}
          {canPlan ? (
            <Button
              variant="ghost"
              size="lg"
              leadingIcon={<CalendarDays />}
              disabled={drafts.length === 0 || isBusy}
              isLoading={persisting === "plan"}
              onClick={() => {
                void persist("plan");
              }}
            >
              {t("workoutEditor.actions.plan")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="workout-editor__shell">
        {saveError ? (
          <div className="training-error" role="alert">
            {saveError}
          </div>
        ) : null}

        <TrainingPanel title={t("workoutEditor.sections.general")}>
          <div className="workout-editor__general">
            <label className="form-label">
              <span className="form-label-text">{t("workoutEditor.fields.name")}</span>
              <InputControl
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("workoutEditor.placeholders.name")}
                disabled={isBusy}
              />
            </label>

            <div className="workout-editor__metric-row">
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">
                  {t("workoutEditor.metrics.caloriesPerMinute")}
                </span>
                <span className="workout-editor__metric-value">
                  {t("workoutEditor.metrics.unavailable")}
                </span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">
                  {t("workoutEditor.metrics.duration")}
                </span>
                <span className="workout-editor__metric-value">
                  {t("workoutEditor.metrics.unavailable")}
                </span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">
                  {t("workoutEditor.metrics.calories")}
                </span>
                <span className="workout-editor__metric-value">
                  {t("workoutEditor.metrics.unavailable")}
                </span>
              </div>
            </div>
          </div>

          <label className="form-label">
            <span className="form-label-text">{t("workoutEditor.fields.notes")}</span>
            <TextareaControl
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder={t("workoutEditor.placeholders.notes")}
              disabled={isBusy}
            />
          </label>
        </TrainingPanel>

        <div className="training-grid workout-editor__main">
          <TrainingPanel title={t("workoutEditor.sections.activity")}>
            <div className="workout-editor__activity-toolbar">
              <label className="form-label">
                <span className="form-label-text">{t("workoutEditor.fields.exercise")}</span>
                <div className="workout-editor__search-control">
                  <Search aria-hidden="true" size={BUTTON_ICON_SIZES.md} />
                  <SelectControl
                    value={selectedExerciseId}
                    onChange={(event) => setSelectedExerciseId(event.target.value)}
                    disabled={isBusy || exercises.isLoading}
                  >
                    <option value="">{t("workoutEditor.placeholders.exercise")}</option>
                    {exercises.data?.data.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </SelectControl>
                </div>
              </label>

              <Button
                variant="ghost"
                size="lg"
                onClick={addExercise}
                disabled={!selectedExercise || isBusy}
              >
                {t("workoutEditor.actions.addExercise")}
              </Button>
            </div>

            {exercises.isError ? (
              <RetryErrorPanel
                message={t("workoutEditor.errors.exercises")}
                retryLabel={t("actions.retry")}
                onRetry={() => {
                  void exercises.refetch();
                }}
                isRetrying={exercises.isFetching}
              />
            ) : null}

            {active ? (
              <>
                <div className="workout-editor__activity-fields">
                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.sets")}</span>
                    <InputControl
                      type="number"
                      min="1"
                      value={active.sets}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          sets: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </label>

                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.repetitions")}</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.repetitions}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          repetitions: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.weight")}</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.weight}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          weight: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.duration")}</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.duration}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          duration: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.exertion")}</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.targetExertion}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          targetExertion: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="workout-editor__rest-row">
                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.restSet")}</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.restSet}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          restSet: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="form-label">
                    <span className="form-label-text">
                      {t("workoutEditor.fields.restExercise")}
                    </span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.restExercise}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          restExercise: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="training-empty">{t("workoutEditor.empty.activity")}</div>
            )}
          </TrainingPanel>

          <TrainingPanel title={t("workoutEditor.sections.overview")}>
            <div className="training-scroll workout-editor__overview-list">
              {drafts.length === 0 ? (
                <div className="training-empty">{t("workoutEditor.empty.overview")}</div>
              ) : (
                drafts.map((exerciseDraft) => (
                  <TrainingSummaryCard
                    key={exerciseDraft.id}
                    title={exerciseDraft.name}
                    meta={t("workoutEditor.summary.sets", {
                      count: exerciseDraft.sets,
                    })}
                    supporting={
                      exerciseDraft.repetitions
                        ? t("workoutEditor.summary.repetitions", {
                            value: exerciseDraft.repetitions,
                          })
                        : undefined
                    }
                  />
                ))
              )}
            </div>

            <div className="workout-editor__overview-actions">
              <IconButton
                icon={<Plus />}
                label={t("workoutEditor.actions.addExercise")}
                onClick={addExercise}
                disabled={!selectedExercise || isBusy}
              />
              <IconButton
                icon={<Minus />}
                label={t("workoutEditor.actions.removeLast")}
                onClick={() => setDrafts((current) => current.slice(0, -1))}
                disabled={drafts.length === 0 || isBusy}
              />
            </div>
          </TrainingPanel>
        </div>
      </div>
    </Modal>
  );
};

export default WorkoutEditor;
