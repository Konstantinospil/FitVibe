import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, ChevronDown, Loader2 } from "lucide-react";
import { listExercises, type Exercise, type ExerciseQuery } from "../services/api";
import { logger } from "../utils/logger";

export interface ExerciseSelectorProps {
  value?: string | null; // exercise_id
  onChange: (exerciseId: string | null, exercise: Exercise | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  excludeArchived?: boolean;
  filterByType?: string;
  filterByMuscleGroup?: string;
}

/**
 * Exercise Selector Component (E2-A5)
 *
 * Displays user's personal exercises, global exercises, and public exercises.
 * Excludes archived exercises. Supports search and filtering.
 *
 * Used in Planner and Logger for exercise selection.
 */
export const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  excludeArchived = true,
  filterByType,
  filterByMuscleGroup,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch exercises when dropdown opens or filters change
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fetchExercises = async () => {
      setIsLoading(true);
      try {
        const query: ExerciseQuery = {
          limit: 100,
          offset: 0,
          // excludeArchived defaults to true, so we exclude archived exercises (include_archived: false)
          // When excludeArchived is false, we include archived (include_archived: true)
          include_archived: excludeArchived === false,
        };

        if (searchQuery.trim()) {
          query.q = searchQuery.trim();
        }

        if (filterByType) {
          query.type_code = filterByType;
        }

        if (filterByMuscleGroup) {
          query.muscle_group = filterByMuscleGroup;
        }

        const response = await listExercises(query);
        setExercises(response.data);
      } catch (error) {
        logger.apiError("Failed to fetch exercises", error, "/api/v1/exercises", "GET");
        setExercises([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      void fetchExercises();
    }, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [isOpen, searchQuery, excludeArchived, filterByType, filterByMuscleGroup]);

  // Load selected exercise when value changes
  useEffect(() => {
    if (value && exercises.length > 0) {
      const exercise = exercises.find((e) => e.id === value);
      if (exercise) {
        setSelectedExercise(exercise);
      }
    } else if (!value) {
      setSelectedExercise(null);
    }
  }, [value, exercises]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    onChange(exercise.id, exercise);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedExercise(null);
    onChange(null, null);
    setIsOpen(false);
    setSearchQuery("");
  };

  const displayValue =
    selectedExercise?.name ||
    placeholder ||
    t("common.exercises.selectExercise", "Select exercise");

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t("common.exercises.selectExercise", "Select exercise")}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-var(--color-bg-secondary, #f5f5f5)
          border border-var(--color-border, #e0e0e0)
          rounded-lg
          text-left
          transition-colors
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-var(--color-bg-tertiary, #ebebeb)"}
          focus:outline-none focus:ring-2 focus:ring-var(--color-primary, var(--color-focus)) focus:ring-offset-2
        `}
      >
        <span className="flex-1 truncate">{displayValue}</span>
        <div className="flex items-center gap-1">
          {selectedExercise && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("common.exercises.clearSelection", "Clear selection")}
              className="p-1 rounded hover:bg-var(--color-bg-tertiary, #ebebeb) transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common.exercises.searchPlaceholder", "Search exercises...")}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-var(--color-primary, var(--color-focus)) bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                aria-label={t("common.exercises.searchLabel", "Search exercises")}
              />
            </div>
          </div>

          {/* Exercise List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" aria-hidden="true" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {t("common.loading", "Loading...")}
                </span>
              </div>
            ) : exercises.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? t("common.exercises.noResults", "No exercises found")
                  : t("common.exercises.noExercises", "No exercises available")}
              </div>
            ) : (
              <ul role="listbox" className="py-1">
                {exercises.map((exercise) => {
                  const isSelected = exercise.id === value;
                  return (
                    <li
                      key={exercise.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(exercise)}
                      className={`
                        px-4 py-2 cursor-pointer transition-colors
                        ${
                          isSelected
                            ? "bg-var(--color-primary, var(--color-focus)) text-white"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{exercise.name}</span>
                        {exercise.owner_id === null && (
                          <span className="text-xs opacity-75 ml-2">
                            {t("common.exercises.global", "Global")}
                          </span>
                        )}
                        {exercise.is_public && exercise.owner_id !== null && (
                          <span className="text-xs opacity-75 ml-2">
                            {t("common.exercises.public", "Public")}
                          </span>
                        )}
                      </div>
                      {exercise.muscle_group && (
                        <div className="text-xs opacity-75 mt-1">{exercise.muscle_group}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
