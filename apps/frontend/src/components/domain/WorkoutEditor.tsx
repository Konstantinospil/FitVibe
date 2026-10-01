import React, { useRef, useState } from "react";
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
import { listExercises } from "../../services/api";
import { Modal } from "../composites/Modal";
import {
  TrainingPanel,
  TrainingSummaryCard,
} from "../composites/TrainingSurface";
import "../../styles/training-surfaces.css";

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

export type WorkoutEditorProps = {
  open: boolean;
  onClose: () => void;
  onStart?: (draft: WorkoutDraft) => void;
  onPlan?: (draft: WorkoutDraft) => void;
};

const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  open,
  onClose,
  onStart,
  onPlan,
}) => {
  const nextDraftId = useRef(0);
  const exercises = useQuery({
    queryKey: ["workout-editor", "exercises"],
    queryFn: () => listExercises({ limit: 250 }),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [drafts, setDrafts] = useState<WorkoutExerciseDraft[]>([]);

  const selectedExercise = exercises.data?.data.find(
    (item) => item.id === selectedExerciseId,
  );

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
    setDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const active = drafts[drafts.length - 1];
  const draft: WorkoutDraft = { name, notes, exercises: drafts };

  return (
    <Modal
      open={open}
      title="Workout Editor"
      closeLabel="Close workout editor"
      onClose={onClose}
      width="lg"
      footer={
        <div className="workout-editor__bottom-actions">
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<Play />}
            fullWidth
            disabled={drafts.length === 0 || !onStart}
            onClick={() => onStart?.(draft)}
          >
            Start
          </Button>
          <Button
            variant="ghost"
            size="lg"
            leadingIcon={<CalendarDays />}
            disabled={drafts.length === 0 || !onPlan}
            onClick={() => onPlan?.(draft)}
          >
            Plan
          </Button>
        </div>
      }
    >
      <div className="workout-editor__shell">
        <TrainingPanel title="General Information">
          <div className="workout-editor__general">
            <label className="form-label">
              <span className="form-label-text">Workout name</span>
              <InputControl
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="A name for the workout"
              />
            </label>

            <div className="workout-editor__metric-row">
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Calories / minute</span>
                <span className="workout-editor__metric-value">—</span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Duration</span>
                <span className="workout-editor__metric-value">—</span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Calories</span>
                <span className="workout-editor__metric-value">—</span>
              </div>
            </div>
          </div>

          <label className="form-label">
            <span className="form-label-text">Notes</span>
            <TextareaControl
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Describe the workout"
            />
          </label>
        </TrainingPanel>

        <div className="training-grid workout-editor__main">
          <TrainingPanel title="Activity">
            <div className="workout-editor__activity-toolbar">
              <label className="form-label">
                <span className="form-label-text">Exercise</span>
                <div className="workout-editor__search-control">
                  <Search
                    aria-hidden="true"
                    size={BUTTON_ICON_SIZES.md}
                  />
                  <SelectControl
                    value={selectedExerciseId}
                    onChange={(event) => setSelectedExerciseId(event.target.value)}
                  >
                    <option value="">Select an exercise</option>
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
                disabled={!selectedExercise}
              >
                Add exercise
              </Button>
            </div>

            {active ? (
              <>
                <div className="workout-editor__activity-fields">
                  <label className="form-label">
                    <span className="form-label-text">Sets</span>
                    <InputControl
                      type="number"
                      min="1"
                      value={active.sets}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          sets: Number(event.target.value) || 1,
                        })
                      }
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">Repetitions</span>
                    <InputControl
                      value={active.repetitions}
                      onChange={(event) =>
                        updateDraft(active.id, { repetitions: event.target.value })
                      }
                      placeholder="1–1000"
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">Resistance / weight</span>
                    <InputControl
                      value={active.weight}
                      onChange={(event) =>
                        updateDraft(active.id, { weight: event.target.value })
                      }
                      placeholder="kg"
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">Duration (seconds)</span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.duration}
                      onChange={(event) =>
                        updateDraft(active.id, { duration: event.target.value })
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">Target exertion</span>
                    <InputControl
                      value={active.targetExertion}
                      onChange={(event) =>
                        updateDraft(active.id, {
                          targetExertion: event.target.value,
                        })
                      }
                      placeholder="1–10"
                    />
                  </label>
                </div>

                <div className="workout-editor__rest-row">
                  <label className="form-label">
                    <span className="form-label-text">
                      Rest after each set (seconds)
                    </span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.restSet}
                      onChange={(event) =>
                        updateDraft(active.id, { restSet: event.target.value })
                      }
                    />
                  </label>
                  <label className="form-label">
                    <span className="form-label-text">
                      Rest after exercise (seconds)
                    </span>
                    <InputControl
                      type="number"
                      min="0"
                      value={active.restExercise}
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
              <div className="training-empty">
                Choose an exercise to start building the workout.
              </div>
            )}
          </TrainingPanel>

          <TrainingPanel title="Overview">
            <div className="training-scroll workout-editor__overview-list">
              {drafts.length === 0 ? (
                <div className="training-empty">No exercises added.</div>
              ) : (
                drafts.map((exerciseDraft) => (
                  <TrainingSummaryCard
                    key={exerciseDraft.id}
                    title={exerciseDraft.name}
                    meta={`${exerciseDraft.sets} set${exerciseDraft.sets === 1 ? "" : "s"}`}
                    supporting={
                      exerciseDraft.repetitions
                        ? `${exerciseDraft.repetitions} repetitions`
                        : undefined
                    }
                  />
                ))
              )}
            </div>

            <div className="workout-editor__overview-actions">
              <IconButton
                icon={<Plus />}
                label="Add selected exercise"
                onClick={addExercise}
                disabled={!selectedExercise}
              />
              <IconButton
                icon={<Minus />}
                label="Remove last exercise"
                onClick={() => setDrafts((current) => current.slice(0, -1))}
                disabled={drafts.length === 0}
              />
            </div>
          </TrainingPanel>
        </div>
      </div>
    </Modal>
  );
};

export default WorkoutEditor;
