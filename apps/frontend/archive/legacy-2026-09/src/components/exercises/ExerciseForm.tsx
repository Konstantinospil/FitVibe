import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { Alert } from "../ui/Alert";
import { Modal } from "../ui/Modal";
import {
  getExercise,
  createExercise,
  updateExercise,
  type Exercise,
  type CreateExerciseRequest,
  type UpdateExerciseRequest,
} from "../../services/api";
import { useToast } from "../ui/Toast";

export interface ExerciseFormProps {
  exerciseId?: string;
  onSave?: (exercise: Exercise) => void;
  onCancel?: () => void;
  isOpen?: boolean;
}

/**
 * ExerciseForm component for creating and editing exercises.
 * Handles exercise name, category, muscle group, equipment, and tags.
 */
export const ExerciseForm: React.FC<ExerciseFormProps> = ({
  exerciseId,
  onSave,
  onCancel,
  isOpen = true,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateExerciseRequest>({
    name: "",
    type_code: "",
    muscle_group: null,
    equipment: null,
    description_en: "",
    tags: [],
  });

  useEffect(() => {
    if (exerciseId) {
      const loadExercise = async () => {
        setIsLoading(true);
        try {
          const exercise = await getExercise(exerciseId);
          setFormData({
            name: exercise.name,
            type_code: exercise.type_code || "",
            muscle_group: exercise.muscle_group || null,
            equipment: exercise.equipment || null,
            description_en: exercise.description_en || "",
            tags: exercise.tags || [],
          });
        } catch {
          setError(t("exercises.loadError") || "Failed to load exercise");
        } finally {
          setIsLoading(false);
        }
      };
      void loadExercise();
    } else {
      // Reset form for new exercise
      setFormData({
        name: "",
        type_code: "",
        muscle_group: null,
        equipment: null,
        description_en: "",
        tags: [],
      });
    }
  }, [exerciseId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      let exercise: Exercise;
      if (exerciseId) {
        exercise = await updateExercise(exerciseId, formData as UpdateExerciseRequest);
      } else {
        exercise = await createExercise(formData);
      }
      showToast({
        variant: "success",
        title: exerciseId
          ? t("exercises.updated") || "Exercise Updated"
          : t("exercises.created") || "Exercise Created",
        message: exerciseId
          ? t("exercises.updatedMessage") || "Exercise has been updated successfully"
          : t("exercises.createdMessage") || "Exercise has been created successfully",
      });
      onSave?.(exercise);
    } catch {
      setError(
        exerciseId
          ? t("exercises.updateError") || "Failed to update exercise"
          : t("exercises.createError") || "Failed to create exercise",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // In a real implementation, these would come from the API
  const typeOptions = [
    { value: "strength", label: t("exercises.types.strength") || "Strength" },
    { value: "agility", label: t("exercises.types.agility") || "Agility" },
    { value: "endurance", label: t("exercises.types.endurance") || "Endurance" },
    { value: "explosivity", label: t("exercises.types.explosivity") || "Explosivity" },
    { value: "intelligence", label: t("exercises.types.intelligence") || "Intelligence" },
    { value: "regeneration", label: t("exercises.types.regeneration") || "Regeneration" },
  ];

  const muscleGroupOptions = [
    { value: "chest", label: t("exercises.muscleGroups.chest") || "Chest" },
    { value: "back", label: t("exercises.muscleGroups.back") || "Back" },
    { value: "shoulders", label: t("exercises.muscleGroups.shoulders") || "Shoulders" },
    { value: "arms", label: t("exercises.muscleGroups.arms") || "Arms" },
    { value: "legs", label: t("exercises.muscleGroups.legs") || "Legs" },
    { value: "core", label: t("exercises.muscleGroups.core") || "Core" },
    { value: "full_body", label: t("exercises.muscleGroups.fullBody") || "Full Body" },
  ];

  const equipmentOptions = [
    { value: "bodyweight", label: t("exercises.equipment.bodyweight") || "Bodyweight" },
    { value: "dumbbells", label: t("exercises.equipment.dumbbells") || "Dumbbells" },
    { value: "barbell", label: t("exercises.equipment.barbell") || "Barbell" },
    { value: "machine", label: t("exercises.equipment.machine") || "Machine" },
    { value: "cable", label: t("exercises.equipment.cable") || "Cable" },
    { value: "kettlebell", label: t("exercises.equipment.kettlebell") || "Kettlebell" },
    { value: "other", label: t("exercises.equipment.other") || "Other" },
  ];

  const formContent = (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="flex flex--column flex--gap-lg"
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <Input
        label={t("exercises.name") || "Exercise Name"}
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder={t("exercises.namePlaceholder") || "Enter exercise name"}
        required
        maxLength={100}
      />

      <Select
        label={t("exercises.type") || "Type"}
        options={typeOptions}
        value={formData.type_code || ""}
        onChange={(e) => setFormData({ ...formData, type_code: e.target.value })}
        placeholder={t("exercises.typePlaceholder") || "Select exercise type"}
      />

      <Select
        label={t("exercises.muscleGroup") || "Muscle Group"}
        options={muscleGroupOptions}
        value={formData.muscle_group || ""}
        onChange={(e) => setFormData({ ...formData, muscle_group: e.target.value || null })}
        placeholder={t("exercises.muscleGroupPlaceholder") || "Select muscle group"}
      />

      <Select
        label={t("exercises.equipment") || "Equipment"}
        options={equipmentOptions}
        value={formData.equipment || ""}
        onChange={(e) => setFormData({ ...formData, equipment: e.target.value || null })}
        placeholder={t("exercises.equipmentPlaceholder") || "Select equipment"}
      />

      <Textarea
        label={t("exercises.description") || "Description"}
        value={formData.description_en || ""}
        onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
        placeholder={t("exercises.descriptionPlaceholder") || "Enter exercise description"}
        rows={4}
        maxLength={1000}
      />

      <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} type="button">
            {t("common.cancel") || "Cancel"}
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSaving}>
          {exerciseId
            ? t("common.save") || "Save Changes"
            : t("common.create") || "Create Exercise"}
        </Button>
      </div>
    </form>
  );

  if (isOpen === false) {
    return null;
  }

  if (onCancel || !isOpen) {
    // Render as modal if onCancel is provided or isOpen is explicitly false
    return (
      <Modal
        isOpen={isOpen ?? true}
        onClose={onCancel || (() => {})}
        title={
          exerciseId
            ? t("exercises.edit") || "Edit Exercise"
            : t("exercises.create") || "Create Exercise"
        }
        size="lg"
      >
        {isLoading ? (
          <div style={{ padding: "var(--space-xl)", textAlign: "center" }}>
            <div className="spinner" />
          </div>
        ) : (
          formContent
        )}
      </Modal>
    );
  }

  // Render as card if no modal behavior needed
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {exerciseId
            ? t("exercises.edit") || "Edit Exercise"
            : t("exercises.create") || "Create Exercise"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div style={{ padding: "var(--space-xl)", textAlign: "center" }}>
            <div className="spinner" />
          </div>
        ) : (
          formContent
        )}
      </CardContent>
    </Card>
  );
};
