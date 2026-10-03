import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Edit, Trash2, X, Save, Globe, Lock, Unlock } from "lucide-react";
import PageIntro from "../components/PageIntro";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/Card";
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  type Exercise,
  type CreateExerciseRequest,
  type UpdateExerciseRequest,
  type ExerciseQuery,
} from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useAuthStore } from "../store/auth.store";
import { logger } from "../utils/logger";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";

const Exercises: React.FC = () => {
  const { t } = useTranslation("common");
  const toast = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  // State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterMuscleGroup] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);

  // Edit/Create modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateExerciseRequest>({
    name: "",
    type_code: "",
    muscle_group: "",
    equipment: "",
    tags: [],
    is_public: false,
    description_en: "",
  });

  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const query: ExerciseQuery = {
        limit: 100,
        offset: 0,
        include_archived: showArchived,
      };

      if (searchQuery.trim()) {
        query.q = searchQuery.trim();
      }

      if (filterType) {
        query.type_code = filterType;
      }

      if (filterMuscleGroup) {
        query.muscle_group = filterMuscleGroup;
      }

      const response = await listExercises(query);
      setExercises(response.data);
    } catch (error) {
      logger.apiError("Failed to load exercises", error, "/api/v1/exercises", "GET");
      toast.error(t("exercises.loadError", "Failed to load exercises"));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType, filterMuscleGroup, showArchived, toast, t]);

  // Load exercises
  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const handleCreate = () => {
    setFormData({
      name: "",
      type_code: "",
      muscle_group: "",
      equipment: "",
      tags: [],
      is_public: false,
      description_en: "",
    });
    setEditingExercise(null);
    setIsEditing(true);
  };

  const handleEdit = (exercise: Exercise) => {
    // Only allow editing own exercises or global exercises (if admin)
    if (!isAdmin && exercise.owner_id !== null && exercise.owner_id !== user?.id) {
      toast.error(t("exercises.cannotEdit", "You can only edit your own exercises"));
      return;
    }

    setFormData({
      name: exercise.name,
      type_code: exercise.type_code || "",
      muscle_group: exercise.muscle_group || "",
      equipment: exercise.equipment || "",
      tags: exercise.tags || [],
      is_public: exercise.is_public,
      description_en: exercise.description_en || "",
    });
    setEditingExercise(exercise);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.type_code.trim()) {
      toast.error(t("exercises.requiredFields", "Name and type are required"));
      return;
    }

    try {
      if (editingExercise) {
        const updatePayload: UpdateExerciseRequest = {
          name: formData.name,
          type_code: formData.type_code,
          muscle_group: formData.muscle_group || null,
          equipment: formData.equipment || null,
          tags: formData.tags,
          is_public: formData.is_public,
          description_en: formData.description_en || null,
        };
        await updateExercise(editingExercise.id, updatePayload);
        toast.success(t("exercises.updated", "Exercise updated successfully"));
      } else {
        await createExercise(formData);
        toast.success(t("exercises.created", "Exercise created successfully"));
      }
      setIsEditing(false);
      setEditingExercise(null);
      void loadExercises();
    } catch (error) {
      logger.apiError(
        "Failed to save exercise",
        error,
        editingExercise ? `/api/v1/exercises/${editingExercise.id}` : "/api/v1/exercises",
        editingExercise ? "PUT" : "POST",
      );
      toast.error(
        editingExercise
          ? t("exercises.updateError", "Failed to update exercise")
          : t("exercises.createError", "Failed to create exercise"),
      );
    }
  };

  const handleDelete = async () => {
    if (!exerciseToDelete) {
      return;
    }

    try {
      await deleteExercise(exerciseToDelete.id);
      toast.success(t("exercises.deleted", "Exercise archived successfully"));
      setShowDeleteDialog(false);
      setExerciseToDelete(null);
      void loadExercises();
    } catch (error) {
      logger.apiError(
        "Failed to delete exercise",
        error,
        `/api/v1/exercises/${exerciseToDelete.id}`,
        "DELETE",
      );
      toast.error(t("exercises.deleteError", "Failed to archive exercise"));
    }
  };

  const handleArchive = (exercise: Exercise) => {
    // Only allow archiving own exercises or global exercises (if admin)
    if (!isAdmin && exercise.owner_id !== null && exercise.owner_id !== user?.id) {
      toast.error(t("exercises.cannotArchive", "You can only archive your own exercises"));
      return;
    }
    setExerciseToDelete(exercise);
    setShowDeleteDialog(true);
  };

  const canEdit = (exercise: Exercise) => {
    return isAdmin || exercise.owner_id === user?.id || exercise.owner_id === null;
  };

  const canArchive = (exercise: Exercise) => {
    return isAdmin || exercise.owner_id === user?.id;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <PageIntro
        eyebrow={t("exercises.page.eyebrow", "Exercise Library")}
        title={t("exercises.page.title", "Manage Your Exercises")}
        description={t(
          "exercises.page.description",
          "Create, edit, and manage your personal exercise library. Global exercises are available to all users.",
        )}
      />

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <InputControl
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("exercises.searchPlaceholder", "Search exercises...")}
              className="w-full"
              style={{ paddingLeft: "2.5rem" }}
              aria-label={t("exercises.searchLabel", "Search exercises")}
            />
          </div>

          {/* Filters */}
          <SelectControl
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label={t("exercises.filterType", "Filter by type")}
          >
            <option value="">{t("exercises.allTypes", "All Types")}</option>
            <option value="strength">{t("exercises.type.strength", "Strength")}</option>
            <option value="cardio">{t("exercises.type.cardio", "Cardio")}</option>
            <option value="power-endurance">
              {t("exercises.type.powerEndurance", "Power-Endurance")}
            </option>
          </SelectControl>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
              aria-label={t("exercises.showArchived", "Show archived exercises")}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("exercises.showArchived", "Show archived")}
            </span>
          </label>
        </div>

        <Button onClick={handleCreate} leftIcon={<Plus size={18} />}>
          {t("exercises.create", "Create Exercise")}
        </Button>
      </div>

      {/* Exercises List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">{t("common.loading", "Loading...")}</p>
        </div>
      ) : exercises.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? t("exercises.noResults", "No exercises found")
                : t("exercises.noExercises", "No exercises available")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exercises.map((exercise) => (
            <Card key={exercise.id} data-testid="exercise-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{exercise.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {exercise.owner_id === null ? (
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Globe size={12} />
                          {t("exercises.global", "Global")}
                        </span>
                      ) : exercise.is_public ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Unlock size={12} />
                          {t("exercises.public", "Public")}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <Lock size={12} />
                          {t("exercises.private", "Private")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {exercise.type_code && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <strong>{t("exercises.type", "Type")}:</strong> {exercise.type_code}
                  </p>
                )}
                {exercise.muscle_group && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <strong>{t("exercises.muscleGroup", "Muscle Group")}:</strong>{" "}
                    {exercise.muscle_group}
                  </p>
                )}
                {exercise.equipment && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <strong>{t("exercises.equipment", "Equipment")}:</strong> {exercise.equipment}
                  </p>
                )}
                {exercise.tags && exercise.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {exercise.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {exercise.description_en && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                    {exercise.description_en}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                {canEdit(exercise) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(exercise)}
                    leftIcon={<Edit size={16} />}
                  >
                    {t("common.edit", "Edit")}
                  </Button>
                )}
                {canArchive(exercise) && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleArchive(exercise)}
                    leftIcon={<Trash2 size={16} />}
                  >
                    {t("common.archive", "Archive")}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingExercise
                    ? t("exercises.edit", "Edit Exercise")
                    : t("exercises.create", "Create Exercise")}
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingExercise(null);
                  }}
                  aria-label={t("common.close", "Close")}
                >
                  <X size={20} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("exercises.name", "Name")} *
                </label>
                <InputControl
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("exercises.type", "Type")} *
                </label>
                <SelectControl
                  value={formData.type_code}
                  onChange={(e) => setFormData({ ...formData, type_code: e.target.value })}
                  required
                >
                  <option value="">{t("common.select", "Select...")}</option>
                  <option value="strength">{t("exercises.type.strength", "Strength")}</option>
                  <option value="cardio">{t("exercises.type.cardio", "Cardio")}</option>
                  <option value="power-endurance">
                    {t("exercises.type.powerEndurance", "Power-Endurance")}
                  </option>
                </SelectControl>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("exercises.muscleGroup", "Muscle Group")}
                </label>
                <InputControl
                  type="text"
                  value={formData.muscle_group ?? ""}
                  onChange={(e) => setFormData({ ...formData, muscle_group: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("exercises.equipment", "Equipment")}
                </label>
                <InputControl
                  type="text"
                  value={formData.equipment ?? ""}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("exercises.description", "Description")}
                </label>
                <TextareaControl
                  value={formData.description_en ?? ""}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {t("exercises.makePublic", "Make this exercise public")}
                  </span>
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                onClick={() => {
                  void handleSave();
                }}
                leftIcon={<Save size={18} />}
              >
                {t("common.save", "Save")}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onCancel={() => {
          setShowDeleteDialog(false);
          setExerciseToDelete(null);
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={t("exercises.archiveConfirm", "Archive Exercise")}
        message={t(
          "exercises.archiveMessage",
          "Are you sure you want to archive this exercise? It will be hidden from selectors but retained for historical records.",
        )}
        confirmLabel={t("common.archive", "Archive")}
        cancelLabel={t("common.cancel", "Cancel")}
      />
    </div>
  );
};

export default Exercises;
