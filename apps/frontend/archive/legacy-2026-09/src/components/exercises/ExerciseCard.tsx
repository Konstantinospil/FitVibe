import React from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, Archive } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Exercise } from "../../services/api";

export interface ExerciseCardProps {
  exercise: Exercise;
  onEdit?: (exerciseId: string) => void;
  onDelete?: (exerciseId: string) => void;
  onArchive?: (exerciseId: string) => void;
  showActions?: boolean;
  onClick?: (exerciseId: string) => void;
}

/**
 * ExerciseCard component displays exercise information in a card format.
 * Shows name, type, muscle group, and action buttons.
 */
export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  onEdit,
  onDelete,
  onArchive,
  showActions = true,
  onClick,
}) => {
  const { t } = useTranslation("common");

  const getVibeColor = (
    typeCode?: string | null,
  ):
    | "strength"
    | "agility"
    | "endurance"
    | "explosivity"
    | "intelligence"
    | "regeneration"
    | undefined => {
    if (!typeCode) {
      return undefined;
    }
    const typeLower = typeCode.toLowerCase();
    if (typeLower.includes("strength")) {
      return "strength";
    }
    if (typeLower.includes("agility")) {
      return "agility";
    }
    if (typeLower.includes("endurance")) {
      return "endurance";
    }
    if (typeLower.includes("explosiv")) {
      return "explosivity";
    }
    if (typeLower.includes("intelligence")) {
      return "intelligence";
    }
    if (typeLower.includes("regeneration")) {
      return "regeneration";
    }
    return undefined;
  };

  const vibeVariant = getVibeColor(exercise.type_code);

  return (
    <Card
      style={{
        cursor: onClick ? "pointer" : "default",
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "var(--shadow-e3)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }
      }}
      onClick={() => onClick?.(exercise.id)}
    >
      <CardContent>
        <div className="flex flex--align-start flex--gap-md">
          <div style={{ flex: 1 }}>
            <div className="flex flex--align-center flex--gap-075 mb-05">
              <h3 className="text-11 font-weight-600 m-0">{exercise.name}</h3>
              {exercise.owner_id === null && (
                <Badge variant="info" size="sm">
                  {t("exercises.global")}
                </Badge>
              )}
              {exercise.is_public && exercise.owner_id !== null && (
                <Badge variant="info" size="sm">
                  {t("exercises.public")}
                </Badge>
              )}
              {!exercise.is_public && exercise.owner_id !== null && (
                <Badge variant="info" size="sm">
                  {t("exercises.private")}
                </Badge>
              )}
            </div>

            {exercise.type_code && (
              <div className="mb-05">
                <Badge variant={vibeVariant || "info"} size="sm">
                  {exercise.type_code}
                </Badge>
              </div>
            )}

            {exercise.muscle_group && (
              <p className="text-09 text-secondary" style={{ margin: "0.5rem 0 0" }}>
                {t("exercises.muscleGroup")}: {exercise.muscle_group}
              </p>
            )}

            {exercise.description_en && (
              <p className="text-09 text-secondary" style={{ margin: "0.5rem 0 0" }}>
                {exercise.description_en}
              </p>
            )}
          </div>

          {showActions && (
            <div className="flex flex--gap-05">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(exercise.id);
                  }}
                  aria-label="Edit exercise"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--border-subtle)",
                    color: "var(--color-text-secondary)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Edit size={18} />
                </button>
              )}
              {onArchive && exercise.owner_id !== null && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(exercise.id);
                  }}
                  aria-label="Archive exercise"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--surface-warning-subtle)",
                    color: "var(--color-warning-text)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Archive size={18} />
                </button>
              )}
              {onDelete && exercise.owner_id !== null && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(exercise.id);
                  }}
                  aria-label="Delete exercise"
                  className="rounded-sm"
                  style={{
                    padding: "0.5rem",
                    background: "var(--surface-danger-subtle)",
                    color: "var(--color-danger)",
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
