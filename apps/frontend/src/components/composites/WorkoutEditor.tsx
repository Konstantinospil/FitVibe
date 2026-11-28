import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Minus, Play, Plus } from "lucide-react";
import { Button, IconButton, InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  createSession,
  updateSession,
  type Exercise,
  type SessionBlockInput,
  type SessionBlockKind,
  type SessionExerciseInput,
  type SessionWithExercises,
} from "../../services/api";
import { listTrainingPlans } from "../../services/planApi";
import { optionalNonNegativeNumber } from "../../lib/forms/numberInput";
import { fromStoredKg, toStoredKg, type LoadUnit } from "../../lib/units/load";
import { useLoadUnit } from "../../hooks/useLoadUnit";
import { logger } from "../../utils/logger";
import { ExercisePicker, useExerciseCatalog, type ExerciseOption } from "./ExercisePicker";
import { Modal } from "./Modal";
import { FormFeedback } from "./FormStack";
import { RetryErrorPanel, StatusPanel } from "./StatusPanel";
import { TrainingPanel, TrainingSummaryCard } from "./TrainingSurface";
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import { joinMetrics } from "../../lib/sessions/setSummary";

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
  /** ADR-046: key of the interval or circuit block this exercise belongs to. */
  blockKey: string | null;
};

/** An interval or circuit block being edited; its members share these values (ADR-046). */
export type WorkoutBlockDraft = {
  kind: SessionBlockKind;
  name: string;
  rounds: number;
  work: string;
  rest: string;
  roundRest: string;
};

/** How the active exercise relates to blocks; "join" adds it to the block above. */
type BlockChoice = "none" | "join" | SessionBlockKind;

const newBlockDraft = (kind: SessionBlockKind): WorkoutBlockDraft => ({
  kind,
  name: "",
  rounds: TRAINING_DATA_CONFIG.blockRoundsDefault,
  work: "",
  rest: "",
  roundRest: "",
});

const clampRounds = (value: number) =>
  Math.min(TRAINING_DATA_CONFIG.blockRoundsMax, Math.max(1, Math.trunc(value) || 1));

/** Blocks in member order, numbered for the request, and each draft's block ref. */
function toBlockPayload(
  drafts: WorkoutExerciseDraft[],
  blocks: Record<string, WorkoutBlockDraft>,
): { blocks: SessionBlockInput[]; refs: Map<string, number> } {
  const refs = new Map<string, number>();
  const payload: SessionBlockInput[] = [];
  for (const draft of drafts) {
    const block = draft.blockKey ? blocks[draft.blockKey] : undefined;
    if (!draft.blockKey || !block || refs.has(draft.blockKey)) {
      continue;
    }
    const ref = payload.length + 1;
    refs.set(draft.blockKey, ref);
    payload.push({
      ref,
      kind: block.kind,
      name: block.name.trim() || null,
      rounds: block.rounds,
      work_sec: optionalNonNegativeNumber(block.work),
      rest_sec: optionalNonNegativeNumber(block.rest),
      round_rest_sec: optionalNonNegativeNumber(block.roundRest),
    });
  }
  return { blocks: payload, refs };
}

/** What stops the blocks from being saved, as an i18n key with its values. */
function blockProblem(
  drafts: WorkoutExerciseDraft[],
  blocks: Record<string, WorkoutBlockDraft>,
): { key: string; values?: Record<string, number> } | null {
  const members = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.blockKey) {
      members.set(draft.blockKey, (members.get(draft.blockKey) ?? 0) + 1);
    }
  }
  for (const [key, count] of members) {
    const block = blocks[key];
    if (block?.kind === "circuit" && count < TRAINING_DATA_CONFIG.blockCircuitMinExercises) {
      return {
        key: "workoutEditor.errors.circuitSize",
        values: { count: TRAINING_DATA_CONFIG.blockCircuitMinExercises },
      };
    }
    const work = block ? optionalNonNegativeNumber(block.work) : null;
    if (
      block?.kind === "interval" &&
      (work === null || work < TRAINING_DATA_CONFIG.blockWorkMinSec)
    ) {
      return { key: "workoutEditor.errors.intervalWork" };
    }
  }
  return null;
}

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
  initialExercise?: Pick<Exercise, "id" | "name"> | null;
  onSaved?: (session: SessionWithExercises) => void;
};

type PersistMode = WorkoutEditorAction;

/** The editor edits a workout's prescription: each set's targets (ADR-042). */
const toDraftExercise = (
  sessionExercise: SessionWithExercises["exercises"][number],
  name: string,
  loadUnit: LoadUnit,
): WorkoutExerciseDraft => {
  const firstTarget = sessionExercise.sets[0]?.planned;
  const storedLoad = sessionExercise.planned?.load ?? firstTarget?.weight_kg;
  return {
    id: sessionExercise.id,
    exerciseId: sessionExercise.exercise_id ?? "",
    name,
    sets: sessionExercise.sets.length || sessionExercise.planned?.sets || 1,
    repetitions: String(sessionExercise.planned?.reps ?? firstTarget?.reps ?? ""),
    weight:
      storedLoad === null || storedLoad === undefined
        ? ""
        : String(fromStoredKg(storedLoad, loadUnit)),
    duration: String(firstTarget?.duration_sec ?? ""),
    targetExertion: String(sessionExercise.planned?.rpe ?? firstTarget?.rpe ?? ""),
    restSet: String(firstTarget?.rest_sec ?? ""),
    restExercise: String(
      typeof sessionExercise.planned?.extras?.rest_after_exercise_sec === "number"
        ? sessionExercise.planned.extras.rest_after_exercise_sec
        : "",
    ),
    blockKey: sessionExercise.block_id ?? null,
  };
};

const toBlockDrafts = (session: SessionWithExercises): Record<string, WorkoutBlockDraft> =>
  Object.fromEntries(
    (session.blocks ?? []).map((block) => [
      block.id,
      {
        kind: block.kind,
        name: block.name ?? "",
        rounds: block.rounds,
        work: block.work_sec === null ? "" : String(block.work_sec),
        rest: block.rest_sec === null ? "" : String(block.rest_sec),
        roundRest: block.round_rest_sec === null ? "" : String(block.round_rest_sec),
      },
    ]),
  );

const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  open,
  onClose,
  session = null,
  plannedAt,
  actions = ["start", "plan"],
  initialExercise = null,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { unit: loadUnit, ready: loadUnitReady } = useLoadUnit();
  const nextDraftId = useRef(0);
  const catalog = useExerciseCatalog({ enabled: open, source: "workout editor" });
  const { names: exerciseNames, reset: resetCatalog } = catalog;

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const plans = useQuery({
    queryKey: ["training-plans"],
    queryFn: listTrainingPlans,
    enabled: open && !session && actions.includes("plan"),
  });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>([]);
  const [blocks, setBlocks] = useState<Record<string, WorkoutBlockDraft>>({});
  const [persisting, setPersisting] = useState<PersistMode | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const exerciseFallbackName = t("workoutEditor.exerciseFallback");

  useEffect(() => {
    // Wait for the load unit: re-running this effect resets the form.
    if (!open || !loadUnitReady) {
      return;
    }

    setSaveError(null);
    resetCatalog();
    setSelectedPlanId(session?.plan_id ?? "");

    if (!session) {
      setName("");
      setNotes("");
      setBlocks({});
      if (initialExercise) {
        nextDraftId.current += 1;
        setDrafts([
          {
            id: `${initialExercise.id}-initial-${nextDraftId.current}`,
            exerciseId: initialExercise.id,
            name: initialExercise.name,
            sets: 1,
            repetitions: "",
            weight: "",
            duration: "",
            targetExertion: "",
            restSet: "",
            restExercise: "",
            blockKey: null,
          },
        ]);
      } else {
        setDrafts([]);
      }
      return;
    }

    setName(session.title ?? "");
    setNotes(session.notes ?? "");
    setBlocks(toBlockDrafts(session));
    setDrafts(
      session.exercises
        .filter((exercise) => Boolean(exercise.exercise_id))
        .map((exercise) => toDraftExercise(exercise, exerciseFallbackName, loadUnit)),
    );
  }, [exerciseFallbackName, initialExercise, loadUnit, loadUnitReady, open, resetCatalog, session]);

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

  const addExercise = (selectedExercise: ExerciseOption | undefined) => {
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
      blockKey: null,
    };

    setDrafts((current) => [...current, draft]);
  };

  const updateDraft = (id: string, patch: Partial<WorkoutExerciseDraft>) => {
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateBlock = (key: string, patch: Partial<WorkoutBlockDraft>) => {
    setBlocks((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  const chooseBlock =
    (draft: WorkoutExerciseDraft, previous: WorkoutExerciseDraft | undefined) =>
    (choice: BlockChoice) => {
      if (choice === "none") {
        updateDraft(draft.id, { blockKey: null });
      } else if (choice === "join") {
        updateDraft(draft.id, { blockKey: previous?.blockKey ?? null });
      } else {
        nextDraftId.current += 1;
        const key = `block-${nextDraftId.current}`;
        setBlocks((current) => ({ ...current, [key]: newBlockDraft(choice) }));
        updateDraft(draft.id, { blockKey: key });
      }
    };

  /**
   * A member's rounds are its sets (ADR-046): an interval's work and rest become
   * each round's targets, and a circuit's rest follows each exercise.
   */
  const toSessionExercise = (
    exercise: WorkoutExerciseDraft,
    order: number,
    blockRef: number | null,
  ): SessionExerciseInput => {
    const block = exercise.blockKey ? blocks[exercise.blockKey] : undefined;
    const repetitions = optionalNonNegativeNumber(exercise.repetitions);
    const enteredLoad = optionalNonNegativeNumber(exercise.weight);
    const weight = enteredLoad === null ? null : toStoredKg(enteredLoad, loadUnit);
    const duration =
      block?.kind === "interval"
        ? optionalNonNegativeNumber(block.work)
        : optionalNonNegativeNumber(exercise.duration);
    const exertion = optionalNonNegativeNumber(exercise.targetExertion);
    const restSet = block
      ? optionalNonNegativeNumber(block.rest)
      : optionalNonNegativeNumber(exercise.restSet);
    const restExercise = optionalNonNegativeNumber(exercise.restExercise);
    const setCount = block ? block.rounds : exercise.sets;

    return {
      exercise_id: exercise.exerciseId,
      order,
      block_ref: blockRef,
      planned: {
        sets: setCount,
        reps: repetitions,
        load: weight,
        rpe: exertion,
        extras: restExercise === null ? undefined : { rest_after_exercise_sec: restExercise },
      },
      sets: Array.from({ length: setCount }, (_, setIndex) => ({
        order: setIndex + 1,
        status: "planned" as const,
        planned: {
          reps: repetitions,
          weight_kg: weight,
          duration_sec: duration,
          rpe: exertion,
          rest_sec: restSet,
        },
      })),
    };
  };

  const problem = blockProblem(drafts, blocks);

  const persist = async (mode: PersistMode) => {
    if (persisting || drafts.length === 0 || problem) {
      return;
    }

    setPersisting(mode);
    setSaveError(null);

    const resolvedPlannedAt = session?.planned_at ?? plannedAt ?? new Date().toISOString();
    const blockPayload = toBlockPayload(drafts, blocks);
    const exercisesPayload = drafts.map((draft, index) =>
      toSessionExercise(
        draft,
        index + 1,
        draft.blockKey ? (blockPayload.refs.get(draft.blockKey) ?? null) : null,
      ),
    );

    try {
      const saved = session
        ? await updateSession(session.id, {
            title: name.trim() || null,
            notes: notes.trim() || null,
            planned_at: resolvedPlannedAt,
            status: mode === "start" ? "in_progress" : "planned",
            started_at: mode === "start" ? (session.started_at ?? new Date().toISOString()) : null,
            exercises: exercisesPayload,
            blocks: blockPayload.blocks,
          })
        : await createSession({
            title: name.trim() || null,
            notes: notes.trim() || null,
            planned_at: resolvedPlannedAt,
            visibility: "private",
            ...(mode === "plan" && selectedPlanId ? { plan_id: selectedPlanId } : {}),
            exercises: exercisesPayload,
            blocks: blockPayload.blocks,
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

  // The editor edits the last exercise added; the one before it may hold its block.
  const activeIndex = drafts.length - 1;
  const active = drafts[activeIndex];
  const previous = drafts[activeIndex - 1];
  const activeBlock = active?.blockKey ? blocks[active.blockKey] : undefined;
  const activeChoice: BlockChoice = !active?.blockKey
    ? "none"
    : active.blockKey === previous?.blockKey
      ? "join"
      : (activeBlock?.kind ?? "none");
  const isBusy = persisting !== null || !loadUnitReady;
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
              disabled={drafts.length === 0 || isBusy || problem !== null}
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
              disabled={drafts.length === 0 || isBusy || problem !== null}
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
      {/* The form waits for the load unit, so nothing typed is reset or read in the other unit. */}
      {!loadUnitReady ? (
        <StatusPanel kind="loading">{t("loading.app")}</StatusPanel>
      ) : (
        <div className="workout-editor__shell">
          {saveError ? (
            <div className="training-error" role="alert">
              {saveError}
            </div>
          ) : null}

          <TrainingPanel title={t("workoutEditor.sections.general")}>
            {canPlan && !session ? (
              <label className="form-label">
                <span className="form-label-text">{t("workoutEditor.fields.trainingPlan")}</span>
                <SelectControl
                  aria-label={t("workoutEditor.fields.trainingPlan")}
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                  disabled={isBusy || plans.isLoading}
                >
                  <option value="">{t("workoutEditor.placeholders.noTrainingPlan")}</option>
                  {plans.data
                    ?.filter((plan) => !plan.activated_at && plan.status !== "completed")
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                </SelectControl>
              </label>
            ) : null}
            {plans.isError && canPlan && !session ? (
              <RetryErrorPanel
                message={t("trainingPlans.errors.list")}
                retryLabel={t("actions.retry")}
                onRetry={() => void plans.refetch()}
                isRetrying={plans.isFetching}
              />
            ) : null}
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
                maxLength={TRAINING_DATA_CONFIG.sessionNoteMaxLength}
                rows={2}
                placeholder={t("workoutEditor.placeholders.notes")}
                disabled={isBusy}
              />
            </label>
          </TrainingPanel>

          <div className="training-grid workout-editor__main">
            <TrainingPanel title={t("workoutEditor.sections.activity")}>
              <ExercisePicker catalog={catalog} disabled={isBusy} onAdd={addExercise} />

              {active ? (
                <>
                  <label className="form-label">
                    <span className="form-label-text">{t("workoutEditor.fields.block")}</span>
                    <SelectControl
                      value={activeChoice}
                      disabled={isBusy}
                      onChange={(event) =>
                        chooseBlock(active, previous)(event.target.value as BlockChoice)
                      }
                    >
                      <option value="none">{t("workoutEditor.block.none")}</option>
                      {previous?.blockKey ? (
                        <option value="join">{t("workoutEditor.block.join")}</option>
                      ) : null}
                      <option value="interval">{t("workoutEditor.block.newInterval")}</option>
                      <option value="circuit">{t("workoutEditor.block.newCircuit")}</option>
                    </SelectControl>
                  </label>

                  {active.blockKey && activeBlock ? (
                    <div className="workout-editor__activity-fields">
                      <label className="form-label">
                        <span className="form-label-text">
                          {t("workoutEditor.fields.blockName")}
                        </span>
                        <InputControl
                          value={activeBlock.name}
                          maxLength={TRAINING_DATA_CONFIG.blockNameMaxLength}
                          placeholder={t(`sessionBlocks.kind.${activeBlock.kind}`)}
                          disabled={isBusy}
                          onChange={(event) =>
                            updateBlock(active.blockKey!, { name: event.target.value })
                          }
                        />
                      </label>
                      <label className="form-label">
                        <span className="form-label-text">{t("workoutEditor.fields.rounds")}</span>
                        <InputControl
                          type="number"
                          min="1"
                          max={TRAINING_DATA_CONFIG.blockRoundsMax}
                          value={activeBlock.rounds}
                          disabled={isBusy}
                          onChange={(event) =>
                            updateBlock(active.blockKey!, {
                              rounds: clampRounds(Number(event.target.value)),
                            })
                          }
                        />
                      </label>
                      {activeBlock.kind === "interval" ? (
                        <label className="form-label">
                          <span className="form-label-text">{t("workoutEditor.fields.work")}</span>
                          <InputControl
                            type="number"
                            min={TRAINING_DATA_CONFIG.blockWorkMinSec}
                            max={TRAINING_DATA_CONFIG.blockWorkMaxSec}
                            value={activeBlock.work}
                            disabled={isBusy}
                            onChange={(event) =>
                              updateBlock(active.blockKey!, { work: event.target.value })
                            }
                          />
                        </label>
                      ) : null}
                      <label className="form-label">
                        <span className="form-label-text">
                          {t("workoutEditor.fields.blockRest")}
                        </span>
                        <InputControl
                          type="number"
                          min="0"
                          max={TRAINING_DATA_CONFIG.blockRestMaxSec}
                          value={activeBlock.rest}
                          disabled={isBusy}
                          onChange={(event) =>
                            updateBlock(active.blockKey!, { rest: event.target.value })
                          }
                        />
                      </label>
                      <label className="form-label">
                        <span className="form-label-text">
                          {t("workoutEditor.fields.roundRest")}
                        </span>
                        <InputControl
                          type="number"
                          min="0"
                          max={TRAINING_DATA_CONFIG.blockRestMaxSec}
                          value={activeBlock.roundRest}
                          disabled={isBusy}
                          onChange={(event) =>
                            updateBlock(active.blockKey!, { roundRest: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  ) : null}

                  {problem ? (
                    <FormFeedback tone="danger">
                      {t(problem.key, problem.values ?? {})}
                    </FormFeedback>
                  ) : null}

                  <div className="workout-editor__activity-fields">
                    {/* A block member's sets are the block's rounds (ADR-046). */}
                    {activeBlock ? null : (
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
                    )}

                    <label className="form-label">
                      <span className="form-label-text">
                        {t("workoutEditor.fields.repetitions")}
                      </span>
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
                      <span className="form-label-text">
                        {t(
                          loadUnit === "lb"
                            ? "workoutEditor.fields.weightLb"
                            : "workoutEditor.fields.weight",
                        )}
                      </span>
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

                    {/* An interval's work is every member's duration. */}
                    {activeBlock?.kind === "interval" ? null : (
                      <label className="form-label">
                        <span className="form-label-text">
                          {t("workoutEditor.fields.duration")}
                        </span>
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
                    )}

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
                    {/* A block's rest replaces the rest after each set. */}
                    {activeBlock ? null : (
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
                    )}

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
                  drafts.map((exerciseDraft) => {
                    const block = exerciseDraft.blockKey
                      ? blocks[exerciseDraft.blockKey]
                      : undefined;
                    const supporting = joinMetrics([
                      block ? block.name.trim() || t(`sessionBlocks.kind.${block.kind}`) : null,
                      exerciseDraft.repetitions
                        ? t("workoutEditor.summary.repetitions", {
                            value: exerciseDraft.repetitions,
                          })
                        : null,
                    ]);
                    return (
                      <TrainingSummaryCard
                        key={exerciseDraft.id}
                        title={exerciseDraft.name}
                        meta={
                          block
                            ? t("sessionBlocks.rounds", { count: block.rounds })
                            : t("workoutEditor.summary.sets", { count: exerciseDraft.sets })
                        }
                        supporting={supporting || undefined}
                      />
                    );
                  })
                )}
              </div>

              <div className="workout-editor__overview-actions">
                <IconButton
                  icon={<Plus />}
                  label={t("workoutEditor.actions.addExercise")}
                  onClick={() => addExercise(catalog.selected)}
                  disabled={!catalog.selected || isBusy}
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
      )}
    </Modal>
  );
};

export default WorkoutEditor;
