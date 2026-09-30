import React from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../ui";
import type { VisibilityLevel } from "./SessionVisibilityToggle";
import { SessionVisibilityToggle } from "./SessionVisibilityToggle";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";

export interface SessionFormData {
  title: string;
  notes: string;
  plannedDate: string;
  plannedTime: string;
  visibility: VisibilityLevel;
}

export interface SessionFormProps {
  data: SessionFormData;
  onChange: (data: SessionFormData) => void;
  errors?: Partial<Record<keyof SessionFormData, string>>;
  disabled?: boolean;
}

/**
 * SessionForm component for editing session details (date, time, visibility).
 * Used in both planner and session editing contexts.
 */
export const SessionForm: React.FC<SessionFormProps> = ({
  data,
  onChange,
  errors = {},
  disabled = false,
}) => {
  const { t } = useTranslation("common");

  const updateField = <K extends keyof SessionFormData>(field: K, value: SessionFormData[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex--column flex--gap-md">
          <FormField
            label={t("planner.sessionTitlePlaceholder") || "Session Title"}
            type="text"
            value={data.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder={t("planner.sessionTitlePlaceholder")}
            error={errors.title}
            disabled={disabled}
          />
          <div>
            <label className="text-sm font-weight-600 mb-sm block">Notes</label>
            <textarea
              value={data.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder={t("planner.notesPlaceholder")}
              disabled={disabled}
              rows={3}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-xl)",
                border: errors.notes
                  ? "1px solid var(--color-danger-border)"
                  : "1px solid var(--color-border)",
                background: "var(--color-input-bg)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-family-base)",
                fontSize: "var(--font-size-md)",
                resize: "vertical",
              }}
            />
            {errors.notes && (
              <p className="text-sm text-danger-text" style={{ marginTop: "0.5rem" }}>
                {errors.notes}
              </p>
            )}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FormField
              label="Date"
              type="date"
              value={data.plannedDate}
              onChange={(e) => updateField("plannedDate", e.target.value)}
              error={errors.plannedDate}
              disabled={disabled}
            />
            <FormField
              label="Time"
              type="time"
              value={data.plannedTime}
              onChange={(e) => updateField("plannedTime", e.target.value)}
              error={errors.plannedTime}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="text-sm font-weight-600 mb-sm block">
              {t("visibility.labels.private") || "Visibility"}
            </label>
            <SessionVisibilityToggle
              value={data.visibility}
              onChange={(value) => updateField("visibility", value)}
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
