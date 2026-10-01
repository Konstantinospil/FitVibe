import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Minus, Play, Plus, Search, X } from "lucide-react";
import {
  Button,
  IconButton,
  InputControl,
  SelectControl,
  TextareaControl,
} from "@fitvibe/ui";
import { listExercises } from "../services/exerciseApi";
import { TrainingPanel, TrainingSummaryCard } from "../components/domain/TrainingSurface";
import "../styles/training-surfaces.css";

type DraftExercise = {
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

const newDraft = (exerciseId: string, name: string): DraftExercise => ({
  id: crypto.randomUUID(),
  exerciseId,
  name,
  sets: 1,
  repetitions: "",
  weight: "",
  duration: "",
  targetExertion: "",
  restSet: "",
  restExercise: "",
});

const WorkoutEditor: React.FC = () => {
  const exercises = useQuery({
    queryKey: ["workout-editor", "exercises"],
    queryFn: () => listExercises({ limit: 250 }),
    staleTime: 5 * 60_000,
  });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [drafts, setDrafts] = useState<DraftExercise[]>([]);

  const selectedExercise = exercises.data?.data.find((item) => item.id === selectedExerciseId);
  const durationSeconds = useMemo(
    () =>
      drafts.reduce((total, item) => {
        const duration = Number(item.duration);
        const rest = Number(item.restSet) * Math.max(0, item.sets - 1) + Number(item.restExercise);
        return total + (Number.isFinite(duration) ? duration : 0) + (Number.isFinite(rest) ? rest : 0);
      }, 0),
    [drafts],
  );

  const formattedDuration = new Date(durationSeconds * 1000).toISOString().slice(11, 19);

  const addExercise = () => {
    if (!selectedExercise) return;
    setDrafts((current) => [...current, newDraft(selectedExercise.id, selectedExercise.name)]);
  };

  const updateDraft = (id: string, patch: Partial<DraftExercise>) => {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const active = drafts[drafts.length - 1];

  return (
    <main className="training-page workout-editor" aria-labelledby="workout-editor-title">
      <div className="workout-editor__shell">
        <div className="workout-editor__titlebar">
          <h1 id="workout-editor-title">Workout Editor</h1>
          <IconButton icon={<X />} label="Close workout editor" variant="ghost" />
        </div>

        <TrainingPanel title="General Information">
          <div className="workout-editor__general">
            <label className="form-label">
              <span className="form-label-text">Workout name</span>
              <InputControl value={name} onChange={(event) => setName(event.target.value)} placeholder="A name for the workout" />
            </label>
            <div className="workout-editor__metric-row">
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Calories / minute</span>
                <span className="workout-editor__metric-value">—</span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Duration</span>
                <span className="workout-editor__metric-value">{formattedDuration}</span>
              </div>
              <div className="workout-editor__metric">
                <span className="workout-editor__metric-label">Calories</span>
                <span className="workout-editor__metric-value">—</span>
              </div>
            </div>
          </div>
          <label className="form-label">
            <span className="form-label-text">Notes</span>
            <TextareaControl value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Describe the workout" />
          </label>
        </TrainingPanel>

        <div className="training-grid workout-editor__main">
          <TrainingPanel title="Activity">
            <div className="workout-editor__activity-toolbar">
              <label className="form-label">
                <span className="form-label-text">Exercise</span>
                <div className="workout-editor__search-control">
                  <Search aria-hidden="true" />
                  <SelectControl value={selectedExerciseId} onChange={(event) => setSelectedExerciseId(event.target.value)}>
                    <option value="">Select an exercise</option>
                    {exercises.data?.data.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                  </SelectControl>
                </div>
              </label>
              <Button variant="ghost" size="lg" onClick={addExercise} disabled={!selectedExercise}>Add exercise</Button>
            </div>

            {active ? (
              <>
                <div className="workout-editor__activity-fields">
                  <label className="form-label"><span className="form-label-text">Sets</span><InputControl type="number" min="1" value={active.sets} onChange={(e) => updateDraft(active.id, { sets: Number(e.target.value) || 1 })} /></label>
                  <label className="form-label"><span className="form-label-text">Repetitions</span><InputControl value={active.repetitions} onChange={(e) => updateDraft(active.id, { repetitions: e.target.value })} placeholder="1–1000" /></label>
                  <label className="form-label"><span className="form-label-text">Resistance / weight</span><InputControl value={active.weight} onChange={(e) => updateDraft(active.id, { weight: e.target.value })} placeholder="kg" /></label>
                  <label className="form-label"><span className="form-label-text">Duration (seconds)</span><InputControl type="number" min="0" value={active.duration} onChange={(e) => updateDraft(active.id, { duration: e.target.value })} placeholder="0" /></label>
                  <label className="form-label"><span className="form-label-text">Target exertion</span><InputControl value={active.targetExertion} onChange={(e) => updateDraft(active.id, { targetExertion: e.target.value })} placeholder="1–10" /></label>
                </div>
                <div className="workout-editor__rest-row">
                  <label className="form-label"><span className="form-label-text">Rest after each set (seconds)</span><InputControl type="number" min="0" value={active.restSet} onChange={(e) => updateDraft(active.id, { restSet: e.target.value })} /></label>
                  <label className="form-label"><span className="form-label-text">Rest after exercise (seconds)</span><InputControl type="number" min="0" value={active.restExercise} onChange={(e) => updateDraft(active.id, { restExercise: e.target.value })} /></label>
                </div>
              </>
            ) : (
              <div className="training-empty">Choose an exercise to start building the workout.</div>
            )}
          </TrainingPanel>

          <TrainingPanel title="Overview">
            <div className="training-scroll workout-editor__overview-list">
              {drafts.length === 0 ? <div className="training-empty">No exercises added.</div> : drafts.map((draft) => (
                <TrainingSummaryCard
                  key={draft.id}
                  title={draft.name}
                  meta={`${draft.sets} set${draft.sets === 1 ? "" : "s"}`}
                  supporting={draft.repetitions ? `${draft.repetitions} repetitions` : undefined}
                />
              ))}
            </div>
            <div className="workout-editor__overview-actions">
              <IconButton icon={<Plus />} label="Add selected exercise" onClick={addExercise} disabled={!selectedExercise} />
              <IconButton icon={<Minus />} label="Remove last exercise" onClick={() => setDrafts((current) => current.slice(0, -1))} disabled={drafts.length === 0} />
            </div>
          </TrainingPanel>
        </div>

        <div className="workout-editor__bottom-actions">
          <Button variant="secondary" size="lg" leadingIcon={<Play />} fullWidth disabled={drafts.length === 0}>Start</Button>
          <Button variant="ghost" size="lg" leadingIcon={<CalendarDays />} disabled={drafts.length === 0}>Plan</Button>
        </div>
      </div>
    </main>
  );
};

export default WorkoutEditor;
