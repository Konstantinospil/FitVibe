import React, { useState, useEffect, useRef } from "react";
import type { SessionVisibility } from "@fitvibe/contracts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Calendar, Save, Trash2 } from "lucide-react";
import PageIntro from "../components/PageIntro";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useRequiredFieldValidation } from "../hooks/useRequiredFieldValidation";
import {
  listExercises,
  createSession,
  type Exercise,
  type SessionExerciseInput,
  type CreateSessionRequest,
} from "../services/api";
import { logger } from "../utils/logger";
import { InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";

interface ExerciseInSession {
  tempId: string;
  exercise: Exercise | null;
  exerciseName: string;
  order: number;
  sets: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  restSec: number | null;
  notes: string;
}

const Planner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  useRequiredFieldValidation(formRef, t);

  // Session metadata
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionVisibility, setSessionVisibility] = useState<SessionVisibility>("private");
  const [plannedDate, setPlannedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [plannedTime, setPlannedTime] = useState("09:00");

  // Exercise management
  const [exercises, setExercises] = useState<ExerciseInSession[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseResults, setExerciseResults] = useState<Exercise[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search exercises with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (exerciseSearch.trim().length < 2) {
      setExerciseResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(
      () =>
        void (async () => {
          try {
            const response = await listExercises({
              q: exerciseSearch,
              limit: 10,
              include_archived: false,
            });
            setExerciseResults(response.data);
            setShowSearchResults(true);
          } catch (error) {
            logger.apiError("Failed to search exercises", error, "/api/v1/exercises", "GET");
            setExerciseResults([]);
          } finally {
            setIsSearching(false);
          }
        })(),
      300,
    );

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [exerciseSearch]);

  const addExercise = (exercise: Exercise) => {
    const newExercise: ExerciseInSession = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      exercise,
      exerciseName: exercise.name,
      order: exercises.length,
      sets: 3,
      reps: 10,
      weightKg: null,
      rpe: null,
      restSec: 90,
      notes: "",
    };
    setExercises([...exercises, newExercise]);
    setExerciseSearch("");
    setShowSearchResults(false);
  };

  const removeExercise = (tempId: string) => {
    setExercises(exercises.filter((ex) => ex.tempId !== tempId));
  };

  const updateExercise = (tempId: string, updates: Partial<ExerciseInSession>) => {
    setExercises(exercises.map((ex) => (ex.tempId === tempId ? { ...ex, ...updates } : ex)));
  };

  const moveExercise = (tempId: string, direction: "up" | "down") => {
    const index = exercises.findIndex((ex) => ex.tempId === tempId);
    if (index === -1) {
      return;
    }
    if (direction === "up" && index === 0) {
      return;
    }
    if (direction === "down" && index === exercises.length - 1) {
      return;
    }

    const newExercises = [...exercises];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newExercises[index], newExercises[targetIndex]] = [
      newExercises[targetIndex],
      newExercises[index],
    ];

    // Update order indices
    newExercises.forEach((ex, i) => {
      ex.order = i;
    });

    setExercises(newExercises);
  };

  const handleSave = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }

    if (exercises.length === 0) {
      setSaveError("Add at least one exercise to your session");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const plannedAt = `${plannedDate}T${plannedTime}:00.000Z`;

      const sessionExercises: SessionExerciseInput[] = exercises.map((ex) => ({
        exercise_id: ex.exercise?.id ?? null,
        order: ex.order,
        notes: ex.notes || null,
        planned: {
          sets: ex.sets,
          reps: ex.reps,
          load: ex.weightKg,
          rpe: ex.rpe,
          rest: ex.restSec ? `${ex.restSec} sec` : null,
        },
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          order: i,
          reps: ex.reps,
          weight_kg: ex.weightKg,
          rpe: ex.rpe,
        })),
      }));

      const payload: CreateSessionRequest = {
        title: sessionTitle || null,
        planned_at: plannedAt,
        notes: sessionNotes || null,
        visibility: sessionVisibility,
        exercises: sessionExercises,
      };

      await createSession(payload);

      // Navigate to sessions list or show success
      void navigate("/sessions");
    } catch (error: unknown) {
      logger.apiError("Failed to create session", error, "/api/v1/sessions", "POST");
      setSaveError("Failed to save session. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageIntro
      eyebrow={t("planner.eyebrow")}
      title={t("planner.title")}
      description={t("planner.description")}
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="form form--gap-lg"
      >
        {/* Session Metadata Card */}
        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid--gap-md">
              <div>
                <label
                  htmlFor="session-title"
                  className="form-label-text block mb-05 font-weight-600"
                >
                  Title (optional)
                </label>
                <InputControl
                  id="session-title"
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder={t("planner.sessionTitlePlaceholder")}
                  className="form-input"
                  style={{ background: "var(--color-surface)" }}
                />
              </div>

              <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
                <div>
                  <label
                    htmlFor="planned-date"
                    className="form-label-text block mb-05 font-weight-600"
                  >
                    <Calendar
                      size={16}
                      className="icon"
                      style={{ marginRight: "0.5rem", verticalAlign: "middle" }}
                    />
                    Planned Date
                  </label>
                  <InputControl
                    id="planned-date"
                    name="planned-date"
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    required
                    className="form-input"
                    style={{ background: "var(--color-surface)" }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="planned-time"
                    className="form-label-text block mb-05 font-weight-600"
                  >
                    Time
                  </label>
                  <InputControl
                    id="planned-time"
                    type="time"
                    value={plannedTime}
                    onChange={(e) => setPlannedTime(e.target.value)}
                    className="form-input"
                    style={{ background: "var(--color-surface)" }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="session-notes"
                  className="form-label-text block mb-05 font-weight-600"
                >
                  Notes (optional)
                </label>
                <TextareaControl
                  id="session-notes"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder={t("planner.notesPlaceholder")}
                  rows={3}
                  className="form-input"
                  style={{
                    background: "var(--color-surface)",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="session-visibility"
                  className="form-label-text block mb-05 font-weight-600"
                >
                  {t("planner.visibility") || "Visibility"}
                </label>
                <SelectControl
                  id="session-visibility"
                  value={sessionVisibility}
                  onChange={(e) => setSessionVisibility(e.target.value as SessionVisibility)}
                  className="form-input"
                  style={{ background: "var(--color-surface)" }}
                  aria-label={t("planner.visibilityLabel") || "Session visibility"}
                >
                  <option value="private">
                    {t("planner.visibilityPrivate") || "Private (only you)"}
                  </option>
                  <option value="followers">
                    {t("visibility.labels.followers") || "Followers"}
                  </option>
                  <option value="link">
                    {t("planner.visibilityLink") || "Link only (unlisted)"}
                  </option>
                  <option value="public">
                    {t("planner.visibilityPublic") || "Public (visible in feed)"}
                  </option>
                </SelectControl>
                <p className="mt-05 text-085 text-muted">
                  {t("planner.visibilityHelp") ||
                    "Private sessions are only visible to you. Link sessions can be shared via link. Public sessions appear in the community feed."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercise Search */}
        <Card>
          <CardHeader>
            <CardTitle>Add Exercises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="relative">
                <Search size={20} className="search-icon" />
                <InputControl
                  type="search"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  onFocus={() => exerciseResults.length > 0 && setShowSearchResults(true)}
                  placeholder={t("planner.exerciseSearchPlaceholder")}
                  aria-label="Search exercises"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem 0.75rem 3rem",
                    borderRadius: "12px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-text-primary)",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && exerciseResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 0.5rem)",
                    left: 0,
                    right: 0,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow-elevated)",
                    maxHeight: "300px",
                    overflowY: "auto",
                    zIndex: 10,
                  }}
                >
                  {exerciseResults.map((exercise) => (
                    <Button
                      key={exercise.id}
                      type="button"
                      variant="ghost"
                      fullWidth
                      onClick={() => addExercise(exercise)}
                      style={{
                        padding: "1rem",
                        borderRadius: 0,
                        background: "transparent",
                        color: "var(--color-text-primary)",
                        textAlign: "left",
                        justifyContent: "flex-start",
                        borderBottom: "1px solid var(--color-border)",
                        boxShadow: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surface-accent-subtle)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{exercise.name}</div>
                      {exercise.muscle_group && (
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--color-text-secondary)",
                            marginTop: "0.25rem",
                          }}
                        >
                          {exercise.muscle_group}
                          {exercise.equipment && ` • ${exercise.equipment}`}
                        </div>
                      )}
                    </Button>
                  ))}
                </div>
              )}

              {isSearching && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    color: "var(--color-text-secondary)",
                    fontSize: "0.9rem",
                  }}
                >
                  Searching...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exercise List */}
        {exercises.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Exercises ({exercises.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: "grid", gap: "1rem" }}>
                {exercises.map((ex, index) => (
                  <div
                    key={ex.tempId}
                    style={{
                      padding: "1.25rem",
                      background: "var(--surface-planner-item)",
                      borderRadius: "14px",
                      border: "1px solid var(--border-planner-item)",
                    }}
                  >
                    {/* Exercise Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveExercise(ex.tempId, "up")}
                          disabled={index === 0}
                          aria-label="Move up"
                          style={{
                            color:
                              index === 0
                                ? "var(--color-text-muted)"
                                : "var(--color-text-secondary)",
                            padding: "0.25rem",
                            lineHeight: 0,
                            boxShadow: "none",
                          }}
                        >
                          ▲
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveExercise(ex.tempId, "down")}
                          disabled={index === exercises.length - 1}
                          aria-label="Move down"
                          style={{
                            color:
                              index === exercises.length - 1
                                ? "var(--color-text-muted)"
                                : "var(--color-text-secondary)",
                            padding: "0.25rem",
                            lineHeight: 0,
                            boxShadow: "none",
                          }}
                        >
                          ▼
                        </Button>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>
                          {index + 1}. {ex.exerciseName}
                        </div>
                        {ex.exercise?.muscle_group && (
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--color-text-secondary)",
                              marginTop: "0.25rem",
                            }}
                          >
                            {ex.exercise.muscle_group}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExercise(ex.tempId)}
                        aria-label="Remove exercise"
                        style={{
                          border: "1px solid var(--color-border)",
                          padding: "0.5rem",
                          color: "var(--color-danger)",
                          lineHeight: 0,
                        }}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>

                    {/* Exercise Parameters */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <label
                          htmlFor={`${ex.tempId}-sets`}
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            marginBottom: "0.35rem",
                            fontWeight: 600,
                          }}
                        >
                          Sets
                        </label>
                        <InputControl
                          id={`${ex.tempId}-sets`}
                          type="number"
                          min="1"
                          value={ex.sets}
                          onChange={(e) =>
                            updateExercise(ex.tempId, { sets: parseInt(e.target.value) || 1 })
                          }
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${ex.tempId}-reps`}
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            marginBottom: "0.35rem",
                            fontWeight: 600,
                          }}
                        >
                          Reps
                        </label>
                        <InputControl
                          id={`${ex.tempId}-reps`}
                          type="number"
                          min="1"
                          value={ex.reps ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.tempId, { reps: parseInt(e.target.value) || null })
                          }
                          placeholder={t("planner.repsPlaceholder")}
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${ex.tempId}-weight`}
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            marginBottom: "0.35rem",
                            fontWeight: 600,
                          }}
                        >
                          Weight (kg)
                        </label>
                        <InputControl
                          id={`${ex.tempId}-weight`}
                          type="number"
                          step="0.5"
                          min="0"
                          value={ex.weightKg ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.tempId, {
                              weightKg: parseFloat(e.target.value) || null,
                            })
                          }
                          placeholder={t("planner.weightPlaceholder")}
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${ex.tempId}-rpe`}
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            marginBottom: "0.35rem",
                            fontWeight: 600,
                          }}
                        >
                          RPE (1-10)
                        </label>
                        <InputControl
                          id={`${ex.tempId}-rpe`}
                          type="number"
                          min="1"
                          max="10"
                          value={ex.rpe ?? ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateExercise(ex.tempId, { rpe: val >= 1 && val <= 10 ? val : null });
                          }}
                          placeholder={t("planner.rpePlaceholder")}
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`${ex.tempId}-rest`}
                          style={{
                            display: "block",
                            fontSize: "0.85rem",
                            marginBottom: "0.35rem",
                            fontWeight: 600,
                          }}
                        >
                          Rest (sec)
                        </label>
                        <InputControl
                          id={`${ex.tempId}-rest`}
                          type="number"
                          min="0"
                          step="15"
                          value={ex.restSec ?? ""}
                          onChange={(e) =>
                            updateExercise(ex.tempId, { restSec: parseInt(e.target.value) || null })
                          }
                          placeholder={t("planner.speedPlaceholder")}
                          style={{
                            width: "100%",
                            padding: "0.6rem",
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            background: "var(--color-surface)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Exercise Notes */}
                    <div style={{ marginTop: "0.75rem" }}>
                      <label
                        htmlFor={`${ex.tempId}-notes`}
                        style={{
                          display: "block",
                          fontSize: "0.85rem",
                          marginBottom: "0.35rem",
                          fontWeight: 600,
                        }}
                      >
                        Notes (optional)
                      </label>
                      <InputControl
                        id={`${ex.tempId}-notes`}
                        type="text"
                        value={ex.notes}
                        onChange={(e) => updateExercise(ex.tempId, { notes: e.target.value })}
                        placeholder={t("planner.exerciseNotesPlaceholder")}
                        style={{
                          width: "100%",
                          padding: "0.6rem",
                          borderRadius: "8px",
                          border: "1px solid var(--color-border)",
                          background: "var(--color-surface)",
                          color: "var(--color-text-primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Actions */}
        <Card>
          <CardContent>
            {saveError && (
              <div
                style={{
                  padding: "1rem",
                  background: "var(--surface-danger-subtle)",
                  border: "1px solid var(--border-danger-subtle)",
                  borderRadius: "12px",
                  color: "var(--color-danger)",
                  marginBottom: "1rem",
                }}
              >
                {saveError}
              </div>
            )}

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <Button
                variant="secondary"
                onClick={() => void navigate("/sessions")}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSaving}
                leftIcon={<Save size={18} />}
                disabled={exercises.length === 0}
              >
                {isSaving ? "Saving..." : "Save Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </PageIntro>
  );
};

export default Planner;
