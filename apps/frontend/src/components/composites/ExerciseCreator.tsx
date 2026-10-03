import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Checkbox, InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import {
  createExercise,
  listExerciseTypes,
  updateExercise,
  type CreateExerciseRequest,
  type Exercise,
  type UpdateExerciseRequest,
} from "../../services/api";
import { logger } from "../../utils/logger";
import { Modal } from "./Modal";
import { RetryErrorPanel } from "./StatusPanel";

export interface ExerciseCreatorProps {
  open: boolean;
  exercise?: Exercise | null;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}

const ExerciseCreator: React.FC<ExerciseCreatorProps> = ({
  open,
  exercise = null,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const types = useQuery({
    queryKey: ["exercise-library", "types"],
    queryFn: listExerciseTypes,
    staleTime: Infinity,
    enabled: open,
  });
  const [name, setName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [metValue, setMetValue] = useState("");
  const [secondsPerRep, setSecondsPerRep] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSaveError(null);
    setName(exercise?.name ?? "");
    setTypeCode(exercise?.type_code ?? "");
    setMuscleGroup(exercise?.muscle_group ?? "");
    setEquipment(exercise?.equipment ?? "");
    setTags(exercise?.tags.join(", ") ?? "");
    setDescription(exercise?.description_en ?? "");
    setMetValue(exercise?.met_value == null ? "" : String(exercise.met_value));
    setSecondsPerRep(
      exercise?.seconds_per_rep == null ? "" : String(exercise.seconds_per_rep),
    );
    setIsPublic(exercise?.is_public ?? false);
  }, [exercise, open]);

  useEffect(() => {
    if (types.error) {
      logger.apiError(
        "Failed to load exercise types",
        types.error,
        "/api/v1/exercise-types",
        "GET",
      );
    }
  }, [types.error]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !typeCode.trim()) {
      setSaveError(t("librarySurface.creator.errors.required"));
      return;
    }

    const payload: CreateExerciseRequest = {
      name: name.trim(),
      type_code: typeCode,
      muscle_group: muscleGroup.trim() || null,
      equipment: equipment.trim() || null,
      tags: Array.from(
        new Set(
          tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        ),
      ),
      description_en: description.trim() || null,
      met_value: metValue.trim() ? Number(metValue) : null,
      seconds_per_rep: secondsPerRep.trim() ? Number(secondsPerRep) : null,
      is_public: isPublic,
    };

    setSaving(true);
    setSaveError(null);
    try {
      const saved = exercise
        ? await updateExercise(exercise.id, payload as UpdateExerciseRequest)
        : await createExercise(payload);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      logger.apiError(
        "Failed to save exercise",
        error,
        exercise ? `/api/v1/exercises/${exercise.id}` : "/api/v1/exercises",
        exercise ? "PUT" : "POST",
      );
      setSaveError(
        exercise
          ? t("librarySurface.creator.errors.update")
          : t("librarySurface.creator.errors.create"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={
        exercise ? t("librarySurface.creator.titleEdit") : t("librarySurface.creator.titleCreate")
      }
      description={t("librarySurface.creator.description")}
      closeLabel={t("librarySurface.actions.close")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("librarySurface.actions.cancel")}
          </Button>
          <Button type="submit" form="exercise-creator-form" isLoading={saving}>
            {t("librarySurface.actions.save")}
          </Button>
        </>
      }
    >
      <form
        id="exercise-creator-form"
        onSubmit={(event) => void submit(event)}
        style={{ display: "grid", gap: "var(--space-md)" }}
      >
        {saveError ? (
          <div className="training-error" role="alert">
            {saveError}
          </div>
        ) : null}

        {types.isError ? (
          <RetryErrorPanel
            message={t("librarySurface.creator.errors.types")}
            retryLabel={t("actions.retry")}
            onRetry={() => void types.refetch()}
            isRetrying={types.isFetching}
          />
        ) : null}

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.name")}</span>
          <InputControl
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.type")}</span>
          <SelectControl
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
            required
            disabled={saving || types.isLoading}
          >
            <option value="">{t("librarySurface.creator.fields.selectType")}</option>
            {(types.data ?? []).map((type) => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </SelectControl>
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.muscleGroup")}</span>
          <InputControl
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.equipment")}</span>
          <InputControl
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.tags")}</span>
          <InputControl
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("librarySurface.creator.fields.tagsPlaceholder")}
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.description")}</span>
          <TextareaControl
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">{t("librarySurface.creator.fields.metValue")}</span>
          <InputControl
            type="number"
            min="0.1"
            max="30"
            step="0.1"
            value={metValue}
            onChange={(event) => setMetValue(event.target.value)}
            disabled={saving}
          />
        </label>

        <label className="form-label">
          <span className="form-label-text">
            {t("librarySurface.creator.fields.secondsPerRep")}
          </span>
          <InputControl
            type="number"
            min="0.1"
            max="120"
            step="0.1"
            value={secondsPerRep}
            onChange={(event) => setSecondsPerRep(event.target.value)}
            disabled={saving}
          />
        </label>

        <Checkbox
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          label={t("librarySurface.creator.fields.public")}
          disabled={saving}
        />
      </form>
    </Modal>
  );
};

export default ExerciseCreator;
