import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Alert } from "../ui/Alert";
import { deleteExercise } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface ExerciseArchiveDialogProps {
  exerciseId: string;
  exerciseName: string;
  isOpen: boolean;
  onClose: () => void;
  onArchived?: () => void;
}

/**
 * ExerciseArchiveDialog component for confirming exercise archival.
 * Provides confirmation before archiving an exercise.
 */
export const ExerciseArchiveDialog: React.FC<ExerciseArchiveDialogProps> = ({
  exerciseId,
  exerciseName,
  isOpen,
  onClose,
  onArchived,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await deleteExercise(exerciseId);
      showToast({
        variant: "success",
        title: t("exercises.archived") || "Exercise Archived",
        message:
          t("exercises.archivedMessage", { name: exerciseName }) ||
          `${exerciseName} has been archived`,
      });
      onArchived?.();
      onClose();
    } catch {
      showToast({
        variant: "error",
        title: t("exercises.archiveFailed") || "Archive Failed",
        message:
          t("exercises.archiveFailedMessage") || "Failed to archive exercise. Please try again.",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("exercises.archiveTitle") || "Archive Exercise"}
      size="md"
    >
      <div className="flex flex--column flex--gap-lg">
        <Alert variant="warning">
          {t("exercises.archiveWarning", { name: exerciseName }) ||
            `Are you sure you want to archive "${exerciseName}"? Archived exercises will be hidden but can be restored later.`}
        </Alert>

        <p className="text-sm text-secondary">
          {t("exercises.archiveDescription") ||
            "Archived exercises will not appear in your exercise list but can be restored if needed. This action can be undone."}
        </p>

        <div className="flex flex--gap-sm" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void handleArchive();
            }}
            isLoading={isArchiving}
            leftIcon={<Archive size={18} />}
          >
            {t("exercises.archive") || "Archive Exercise"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
