import React, { useId } from "react";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { ImageFilePicker } from "./ImageFilePicker";
import { FormActions, FormFeedback, FormStack, type FeedbackTone } from "./FormStack";
import { PHOTO_MESSAGE_VALUES } from "../../lib/sessions/workoutPhoto";
import type { ImageFileProblem } from "../../lib/media/imageFile";

export interface WorkoutPhotoFieldProps {
  /** The photo to show: a chosen file's preview or the stored image's URL. */
  src: string | null;
  onSelect: (file: File) => void;
  onReject: (problem: ImageFileProblem) => void;
  onRemove: () => void;
  busy?: boolean;
  feedback?: { tone: FeedbackTone; text: string } | null;
  /** A smaller preview, for use inside a dialog. */
  compact?: boolean;
}

/** A stored or chosen workout photo, in its own shape; compact as a preview in a dialog. */
export const WorkoutPhoto: React.FC<{ src: string; compact?: boolean }> = ({ src, compact }) => {
  const { t } = useTranslation();
  return (
    <img
      className={compact ? "workout-photo workout-photo--compact" : "workout-photo"}
      src={src}
      alt={t("workoutResult.photo.alt")}
    />
  );
};

/**
 * The optional workout photo (ADR-044): a preview, a button to choose or replace
 * it, and one to remove it. The caller decides when the photo is uploaded.
 */
export const WorkoutPhotoField: React.FC<WorkoutPhotoFieldProps> = ({
  src,
  onSelect,
  onReject,
  onRemove,
  busy,
  feedback,
  compact,
}) => {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <FormStack as="div" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="form-label-text">
        {t("workoutResult.photo.label")}
      </span>
      {src ? <WorkoutPhoto src={src} compact={compact} /> : null}
      <p className="typography-supporting text-secondary">
        {t("workoutResult.photo.help", PHOTO_MESSAGE_VALUES)}
      </p>
      <FormActions>
        <ImageFilePicker
          label={src ? t("workoutResult.photo.replace") : t("workoutResult.photo.add")}
          onSelect={onSelect}
          onReject={onReject}
          disabled={busy}
        />
        {src ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
            {t("workoutResult.photo.remove")}
          </Button>
        ) : null}
      </FormActions>
      {feedback ? <FormFeedback tone={feedback.tone}>{feedback.text}</FormFeedback> : null}
    </FormStack>
  );
};
