import type React from "react";
import { TextareaControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";

export interface ResultNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** The athlete's own note on a workout they did (ADR-044); always optional. */
export const ResultNoteField: React.FC<ResultNoteFieldProps> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();
  return (
    <label className="form-label">
      <span className="form-label-text">{t("workoutResult.note.label")}</span>
      <TextareaControl
        value={value}
        maxLength={TRAINING_DATA_CONFIG.sessionNoteMaxLength}
        placeholder={t("workoutResult.note.placeholder")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
};
