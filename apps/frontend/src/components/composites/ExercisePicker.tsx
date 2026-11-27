import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { BUTTON_ICON_SIZES, Button, InputControl, SelectControl } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import { listExercises, type Exercise } from "../../services/api";
import { TRAINING_DATA_CONFIG } from "../../config/trainingSurfaces";
import { logger } from "../../utils/logger";
import { RetryErrorPanel } from "./StatusPanel";

export type ExerciseOption = Pick<Exercise, "id" | "name">;

/**
 * Searchable exercise catalogue shared by every surface that adds exercises to a
 * workout (the workout editor and manual Log).
 */
export function useExerciseCatalog({ enabled, source }: { enabled: boolean; source: string }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const query = useQuery({
    queryKey: ["exercise-catalog", search.trim()],
    queryFn: () =>
      listExercises({
        q: search.trim() || undefined,
        limit: TRAINING_DATA_CONFIG.exerciseCatalogLimit,
      }),
    staleTime: TRAINING_DATA_CONFIG.exerciseCatalogStaleMs,
    enabled,
  });

  useEffect(() => {
    if (query.error) {
      logger.apiError(
        `Failed to load ${source} exercises`,
        query.error,
        "/api/v1/exercises",
        "GET",
      );
    }
  }, [query.error, source]);

  const options = useMemo(() => query.data?.data ?? [], [query.data]);
  const names = useMemo(
    () => new Map(options.map((exercise) => [exercise.id, exercise.name])),
    [options],
  );
  const selected: ExerciseOption | undefined = options.find((item) => item.id === selectedId);
  // Stable, so surfaces can clear the picker from an effect when they reopen.
  const reset = useCallback(() => {
    setSearch("");
    setSelectedId("");
  }, []);

  return {
    query,
    options,
    names,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setSelectedId("");
    },
    selectedId,
    setSelectedId,
    selected,
    reset,
  };
}

export type ExerciseCatalog = ReturnType<typeof useExerciseCatalog>;

export type ExercisePickerProps = {
  catalog: ExerciseCatalog;
  disabled?: boolean;
  onAdd: (exercise: ExerciseOption) => void;
};

/** Search field, exercise list and add button for an exercise catalogue. */
export const ExercisePicker: React.FC<ExercisePickerProps> = ({ catalog, disabled, onAdd }) => {
  const { t } = useTranslation();
  const { query, options, selected } = catalog;
  const fieldLabel = t("workoutEditor.fields.exercise");

  return (
    <>
      <div className="exercise-picker">
        <div className="form-label">
          <span className="form-label-text">{fieldLabel}</span>
          <div className="exercise-picker__search">
            <Search aria-hidden="true" size={BUTTON_ICON_SIZES.md} />
            <InputControl
              value={catalog.search}
              onChange={(event) => catalog.setSearch(event.target.value)}
              placeholder={t("planner.exerciseSearchPlaceholder")}
              aria-label={`${fieldLabel} ${t("librarySurface.filters.search")}`}
              disabled={disabled}
            />
          </div>
          <SelectControl
            aria-label={fieldLabel}
            value={catalog.selectedId}
            onChange={(event) => catalog.setSelectedId(event.target.value)}
            disabled={disabled || query.isLoading}
          >
            <option value="">{t("workoutEditor.placeholders.exercise")}</option>
            {options.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </SelectControl>
        </div>

        {/* type="button": the picker also sits inside forms (manual Log) and must not submit them. */}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => selected && onAdd(selected)}
          disabled={!selected || disabled}
        >
          {t("workoutEditor.actions.addExercise")}
        </Button>
      </div>

      {query.isError ? (
        <RetryErrorPanel
          message={t("workoutEditor.errors.exercises")}
          retryLabel={t("actions.retry")}
          onRetry={() => {
            void query.refetch();
          }}
          isRetrying={query.isFetching}
        />
      ) : null}
    </>
  );
};
