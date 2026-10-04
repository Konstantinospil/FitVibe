import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { ExerciseSetEditor, type SetData } from "./ExerciseSetEditor";
import type { SessionWithExercises } from "../../services/api";

export interface SessionLoggerProps {
  session: SessionWithExercises;
  onExerciseUpdate?: (exerciseId: string, sets: SetData[]) => void;
  onComplete?: () => void;
}

/**
 * SessionLogger component - Mobile-first stepper form for logging workout sessions.
 * Provides step-by-step exercise logging with progress tracking.
 */
export const SessionLogger: React.FC<SessionLoggerProps> = ({
  session,
  onExerciseUpdate,
  onComplete,
}) => {
  const { t } = useTranslation("common");
  const [currentStep, setCurrentStep] = useState(0);
  const [exerciseData, setExerciseData] = useState<Record<string, SetData[]>>(() => {
    const initial: Record<string, SetData[]> = {};
    session.exercises.forEach((ex) => {
      initial[ex.id] =
        ex.sets.length > 0
          ? ex.sets.map((set) => ({
              order: set.order_index,
              reps: set.reps ?? null,
              weight_kg: set.weight_kg ?? null,
              rpe: set.rpe ?? null,
              rest_sec: null,
              notes: set.notes ?? null,
              completed: false,
            }))
          : ex.planned?.sets
            ? Array.from({ length: ex.planned.sets }, (_, i) => ({
                order: i + 1,
                reps: ex.planned?.reps ?? null,
                weight_kg: ex.planned?.load ?? null,
                rpe: ex.planned?.rpe ?? null,
                rest_sec: null,
                notes: null,
                completed: false,
              }))
            : [
                {
                  order: 1,
                  reps: null,
                  weight_kg: null,
                  rpe: null,
                  rest_sec: null,
                  notes: null,
                  completed: false,
                },
              ];
    });
    return initial;
  });

  const exercises = session.exercises;
  const currentExercise = exercises[currentStep];
  const totalSteps = exercises.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const handleSetsChange = (sets: SetData[]) => {
    if (!currentExercise) {
      return;
    }
    const newData = { ...exerciseData, [currentExercise.id]: sets };
    setExerciseData(newData);
    onExerciseUpdate?.(currentExercise.id, sets);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete?.();
  };

  const handleStepClick = (index: number) => {
    if (index >= 0 && index < totalSteps) {
      setCurrentStep(index);
    }
  };

  if (exercises.length === 0) {
    return (
      <Card>
        <CardContent>
          <div
            className="flex flex--column flex--center"
            style={{ padding: "3rem", textAlign: "center" }}
          >
            <p className="text-secondary">
              {t("logger.noExercises") || "No exercises in this session"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex--column flex--gap-lg">
      {/* Progress Indicator */}
      <Card>
        <CardContent>
          <div className="flex flex--column flex--gap-md">
            <div className="flex flex--align-center flex--justify-between">
              <span className="text-sm font-weight-600">{t("logger.progress") || "Progress"}</span>
              <span className="text-sm text-secondary">
                {currentStep + 1} / {totalSteps}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: "8px",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "var(--color-primary)",
                  transition: "width 0.3s ease",
                }}
                role="progressbar"
                aria-valuenow={currentStep + 1}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
                aria-label={
                  t("logger.progressLabel", { current: currentStep + 1, total: totalSteps }) ||
                  `Exercise ${currentStep + 1} of ${totalSteps}`
                }
              />
            </div>

            {/* Step Indicators */}
            <div className="flex flex--gap-xs" style={{ flexWrap: "wrap" }}>
              {exercises.map((exercise, index) => {
                const isCompleted =
                  exerciseData[exercise.id]?.every((set) => set.completed) ?? false;
                const isCurrent = index === currentStep;
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() => handleStepClick(index)}
                    className="flex flex--align-center flex--center"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: isCurrent
                        ? "2px solid var(--color-primary)"
                        : "2px solid var(--color-border)",
                      background: isCompleted
                        ? "var(--color-success)"
                        : isCurrent
                          ? "var(--color-primary)"
                          : "transparent",
                      color:
                        isCurrent || isCompleted
                          ? "var(--color-text-primary-on)"
                          : "var(--color-text-primary)",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                    }}
                    aria-label={
                      t("logger.goToExercise", {
                        name: `Exercise ${index + 1}`,
                        number: index + 1,
                      }) || `Go to exercise ${index + 1}`
                    }
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted ? <Check size={16} /> : index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Exercise */}
      {currentExercise && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("logger.exercise") || "Exercise"} {currentStep + 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExerciseSetEditor
              sets={exerciseData[currentExercise.id] || []}
              onSetsChange={handleSetsChange}
              showCompleted={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex flex--gap-sm">
        <Button
          variant="secondary"
          onClick={handlePrevious}
          disabled={currentStep === 0}
          leftIcon={<ChevronLeft size={18} />}
          style={{ flex: 1 }}
        >
          {t("common.previous") || "Previous"}
        </Button>
        {currentStep < totalSteps - 1 ? (
          <Button
            variant="primary"
            onClick={handleNext}
            rightIcon={<ChevronRight size={18} />}
            style={{ flex: 1 }}
          >
            {t("common.next") || "Next"}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleComplete}
            leftIcon={<Check size={18} />}
            style={{ flex: 1 }}
          >
            {t("logger.complete") || "Complete Session"}
          </Button>
        )}
      </div>
    </div>
  );
};
