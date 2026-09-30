import React from "react";
import { useTranslation } from "react-i18next";
import { ExerciseCard } from "./ExerciseCard";
import { Card, CardContent } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import type { Exercise } from "../../services/api";

export interface ExerciseListProps {
  exercises: Exercise[];
  loading?: boolean;
  emptyMessage?: string;
  onExerciseClick?: (exerciseId: string) => void;
  onExerciseEdit?: (exerciseId: string) => void;
  onExerciseDelete?: (exerciseId: string) => void;
  onExerciseArchive?: (exerciseId: string) => void;
  showActions?: boolean;
  layout?: "grid" | "list";
}

/**
 * ExerciseList component displays a list or grid of exercises.
 * Supports loading states, empty states, and various actions.
 */
export const ExerciseList: React.FC<ExerciseListProps> = ({
  exercises,
  loading = false,
  emptyMessage,
  onExerciseClick,
  onExerciseEdit,
  onExerciseDelete,
  onExerciseArchive,
  showActions = true,
  layout = "grid",
}) => {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex--center" style={{ padding: "3rem" }}>
            <Spinner size="lg" label={t("common.loading")} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (exercises.length === 0) {
    return (
      <Card>
        <CardContent>
          <div
            className="flex flex--column flex--center"
            style={{ padding: "3rem", textAlign: "center" }}
          >
            <p className="text-secondary">{emptyMessage || t("exercises.noExercises")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const containerStyle: React.CSSProperties =
    layout === "grid"
      ? {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
        }
      : {
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        };

  return (
    <div style={containerStyle}>
      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          onClick={onExerciseClick}
          onEdit={onExerciseEdit}
          onDelete={onExerciseDelete}
          onArchive={onExerciseArchive}
          showActions={showActions}
        />
      ))}
    </div>
  );
};
