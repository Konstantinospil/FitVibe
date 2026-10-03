import React from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "../ui";
import { Card, CardContent } from "../ui/Card";

export type ExerciseType = "strength" | "cardio" | "powerEndurance" | "all";

export interface ExerciseFiltersProps {
  searchQuery: string;
  type: ExerciseType;
  showArchived: boolean;
  onSearchChange: (query: string) => void;
  onTypeChange: (type: ExerciseType) => void;
  onShowArchivedChange: (show: boolean) => void;
}

/**
 * ExerciseFilters component for filtering exercises by type, search, and archived status.
 */
export const ExerciseFilters: React.FC<ExerciseFiltersProps> = ({
  searchQuery,
  type,
  showArchived,
  onSearchChange,
  onTypeChange,
  onShowArchivedChange,
}) => {
  const { t } = useTranslation("common");

  return (
    <Card>
      <CardContent>
        <div className="flex flex--column flex--gap-md">
          <FormField
            label={t("exercises.searchLabel")}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("exercises.searchPlaceholder")}
            size="sm"
          />
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="text-sm font-weight-600 mb-sm block">
                {t("exercises.filterType")}
              </label>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as ExerciseType)}
                style={{
                  width: "100%",
                  padding: "var(--space-sm) var(--space-md)",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-input-bg)",
                  color: "var(--color-text-primary)",
                  fontSize: "var(--font-size-md)",
                }}
              >
                <option value="all">{t("exercises.allTypes")}</option>
                <option value="strength">{t("exercises.type.strength")}</option>
                <option value="cardio">{t("exercises.type.cardio")}</option>
                <option value="powerEndurance">{t("exercises.type.powerEndurance")}</option>
              </select>
            </div>
            <div className="flex flex--align-center" style={{ paddingTop: "1.75rem" }}>
              <label className="flex flex--align-center flex--gap-sm" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => onShowArchivedChange(e.target.checked)}
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    cursor: "pointer",
                  }}
                />
                <span className="text-sm">{t("exercises.showArchived")}</span>
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
