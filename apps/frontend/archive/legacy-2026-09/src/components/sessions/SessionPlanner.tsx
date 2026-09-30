import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ExerciseSetEditor, type SetData } from "./ExerciseSetEditor";
import type { Exercise } from "../../services/api";
import { ScreenReaderOnly } from "../a11y/ScreenReaderOnly";

export interface PlannedExercise {
  id: string;
  exercise: Exercise | null;
  exerciseName: string;
  order: number;
  sets: SetData[];
  notes: string;
}

export interface SessionPlannerProps {
  exercises: PlannedExercise[];
  onExercisesChange: (exercises: PlannedExercise[]) => void;
  onAddExercise?: () => void;
  onRemoveExercise?: (id: string) => void;
}

/**
 * SessionPlanner component with drag-and-drop functionality for reordering exercises.
 * Supports keyboard navigation for accessibility (WCAG 2.2 AA).
 */
export const SessionPlanner: React.FC<SessionPlannerProps> = ({
  exercises,
  onExercisesChange,
  onAddExercise,
  onRemoveExercise,
}) => {
  const { t } = useTranslation("common");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      return;
    }

    const draggedIndex = exercises.findIndex((ex) => ex.id === draggedId);
    const targetIndex = exercises.findIndex((ex) => ex.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const newExercises = [...exercises];
    const [draggedExercise] = newExercises.splice(draggedIndex, 1);
    newExercises.splice(targetIndex, 0, draggedExercise);

    // Update order indices
    newExercises.forEach((ex, index) => {
      ex.order = index;
    });

    onExercisesChange(newExercises);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleKeyboardMove = (id: string, direction: "up" | "down") => {
    const index = exercises.findIndex((ex) => ex.id === id);
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

    newExercises.forEach((ex, i) => {
      ex.order = i;
    });

    onExercisesChange(newExercises);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleKeyboardMove(id, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleKeyboardMove(id, "down");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // Focus handled by browser default behavior
    }
  };

  const updateExercise = (id: string, updates: Partial<PlannedExercise>) => {
    const newExercises = exercises.map((ex) => (ex.id === id ? { ...ex, ...updates } : ex));
    onExercisesChange(newExercises);
  };

  const updateExerciseSets = (id: string, sets: SetData[]) => {
    updateExercise(id, { sets });
  };

  if (exercises.length === 0) {
    return (
      <Card>
        <CardContent>
          <div
            className="flex flex--column flex--center"
            style={{ padding: "3rem", textAlign: "center" }}
          >
            <p className="text-secondary" style={{ marginBottom: "var(--space-lg)" }}>
              {t("planner.noExercises") || "No exercises added yet"}
            </p>
            {onAddExercise && (
              <Button variant="primary" onClick={onAddExercise}>
                {t("planner.addExercise") || "Add Exercise"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex--column flex--gap-md">
      {exercises.map((exercise, index) => (
        <div
          key={exercise.id}
          draggable
          onDragStart={(e) => handleDragStart(e, exercise.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, exercise.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, exercise.id)}
          onKeyDown={(e) => handleKeyDown(e, exercise.id)}
          tabIndex={0}
          role="button"
          aria-label={`${t("planner.exercise") || "Exercise"} ${index + 1}: ${exercise.exerciseName}. ${t("planner.dragInstructions") || "Use arrow keys to reorder"}`}
          style={{
            cursor: "move",
            opacity: draggedId === exercise.id ? 0.5 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          <Card
            style={{
              borderColor: dragOverId === exercise.id ? "var(--color-primary)" : undefined,
              borderWidth: dragOverId === exercise.id ? "2px" : undefined,
              transition: "border-color 150ms ease",
            }}
          >
            <CardContent>
              <div className="flex flex--align-center flex--gap-md mb-md">
                <div
                  className="flex flex--align-center flex--gap-xs"
                  style={{ cursor: "grab", touchAction: "none" }}
                  aria-hidden="true"
                >
                  <GripVertical size={20} style={{ color: "var(--color-text-muted)" }} />
                </div>
                <div className="flex flex--align-center flex--justify-between" style={{ flex: 1 }}>
                  <div>
                    <h4 className="text-md font-weight-600 m-0">
                      {exercise.exerciseName || t("planner.unnamedExercise") || "Unnamed Exercise"}
                    </h4>
                    <ScreenReaderOnly>
                      {t("planner.exerciseOrder", {
                        order: exercise.order + 1,
                        total: exercises.length,
                      }) || `Exercise ${exercise.order + 1} of ${exercises.length}`}
                    </ScreenReaderOnly>
                  </div>
                  <div className="flex flex--gap-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKeyboardMove(exercise.id, "up")}
                      disabled={index === 0}
                      aria-label={t("planner.moveUp") || `Move ${exercise.exerciseName} up`}
                      leftIcon={<ChevronUp size={16} />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleKeyboardMove(exercise.id, "down")}
                      disabled={index === exercises.length - 1}
                      aria-label={t("planner.moveDown") || `Move ${exercise.exerciseName} down`}
                      leftIcon={<ChevronDown size={16} />}
                    />
                    {onRemoveExercise && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveExercise(exercise.id)}
                        aria-label={
                          t("planner.removeExercise") || `Remove ${exercise.exerciseName}`
                        }
                        leftIcon={<Trash2 size={16} />}
                      />
                    )}
                  </div>
                </div>
              </div>

              <ExerciseSetEditor
                sets={exercise.sets}
                onSetsChange={(sets) => updateExerciseSets(exercise.id, sets)}
                exerciseName={exercise.exerciseName}
              />

              <div style={{ marginTop: "var(--space-md)" }}>
                <Input
                  label={t("planner.notes") || "Notes"}
                  value={exercise.notes}
                  onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })}
                  placeholder={t("planner.notesPlaceholder") || "Add notes for this exercise"}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
};
