import React from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../ui";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Trash2, Plus } from "lucide-react";

export interface SetData {
  order: number;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  rest_sec: number | null;
  notes: string | null;
  completed?: boolean;
}

export interface ExerciseSetEditorProps {
  sets: SetData[];
  onSetsChange: (sets: SetData[]) => void;
  exerciseName?: string;
  showCompleted?: boolean;
}

/**
 * ExerciseSetEditor component for editing sets, reps, load, and RPE.
 * Mobile-first design with stepper functionality.
 */
export const ExerciseSetEditor: React.FC<ExerciseSetEditorProps> = ({
  sets,
  onSetsChange,
  exerciseName,
  showCompleted = false,
}) => {
  const { t } = useTranslation("common");

  const updateSet = (index: number, updates: Partial<SetData>) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], ...updates };
    onSetsChange(newSets);
  };

  const addSet = () => {
    const newSet: SetData = {
      order: sets.length + 1,
      reps: sets.length > 0 ? sets[sets.length - 1].reps : null,
      weight_kg: sets.length > 0 ? sets[sets.length - 1].weight_kg : null,
      rpe: null,
      rest_sec: null,
      notes: null,
      completed: false,
    };
    onSetsChange([...sets, newSet]);
  };

  const removeSet = (index: number) => {
    const newSets = sets
      .filter((_, i) => i !== index)
      .map((set, i) => ({
        ...set,
        order: i + 1,
      }));
    onSetsChange(newSets);
  };

  const toggleSetCompleted = (index: number) => {
    if (!showCompleted) {
      return;
    }
    updateSet(index, { completed: !sets[index].completed });
  };

  return (
    <Card>
      <CardContent>
        {exerciseName && (
          <h4 className="text-md font-weight-600 mb-md" style={{ marginBottom: "1rem" }}>
            {exerciseName}
          </h4>
        )}
        <div className="flex flex--column flex--gap-md">
          {sets.map((set, index) => (
            <div
              key={index}
              className="flex flex--column flex--gap-sm"
              style={{
                padding: "1rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                background: set.completed ? "rgba(34, 197, 94, 0.1)" : "var(--color-surface)",
              }}
            >
              <div className="flex flex--align-center flex--justify-between mb-sm">
                <span className="text-sm font-weight-600">
                  {t("logger.sets")} {set.order}
                </span>
                {sets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSet(index)}
                    leftIcon={<Trash2 size={14} />}
                    aria-label={`Remove set ${set.order}`}
                  />
                )}
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <FormField
                  label={t("logger.reps")}
                  type="number"
                  min="0"
                  value={set.reps?.toString() || ""}
                  onChange={(e) =>
                    updateSet(index, {
                      reps: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  placeholder={t("logger.repsPlaceholder")}
                  size="sm"
                />
                <FormField
                  label={t("logger.load")}
                  type="number"
                  min="0"
                  step="0.5"
                  value={set.weight_kg?.toString() || ""}
                  onChange={(e) =>
                    updateSet(index, {
                      weight_kg: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder={t("logger.weightPlaceholder")}
                  size="sm"
                />
                <FormField
                  label="RPE"
                  type="number"
                  min="1"
                  max="10"
                  value={set.rpe?.toString() || ""}
                  onChange={(e) =>
                    updateSet(index, {
                      rpe: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  placeholder={t("logger.rpePlaceholder")}
                  size="sm"
                />
              </div>
              {showCompleted && (
                <div className="flex flex--align-center flex--gap-sm mt-sm">
                  <input
                    type="checkbox"
                    checked={set.completed || false}
                    onChange={() => toggleSetCompleted(index)}
                    id={`set-${index}-completed`}
                    style={{
                      width: "1.25rem",
                      height: "1.25rem",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor={`set-${index}-completed`}
                    className="text-sm"
                    style={{ cursor: "pointer" }}
                  >
                    Completed
                  </label>
                </div>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={addSet}
            leftIcon={<Plus size={16} />}
            fullWidth
          >
            Add Set
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
