import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Spinner } from "../ui/Spinner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { EmptyState } from "../utils/EmptyState";
import { Database } from "lucide-react";
import {
  createExerciseType,
  deleteExerciseType,
  listExerciseTypes,
  updateExerciseType,
  type CatalogExerciseType,
} from "../../services/api";

export interface ExerciseType {
  id: string;
  code: string;
  nameEn: string;
  descriptionEn?: string;
}

export interface ExerciseTypeManagerProps {
  onTypeCreated?: (type: ExerciseType) => void;
  onTypeUpdated?: (type: ExerciseType) => void;
  onTypeDeleted?: (id: string) => void;
}

function toUiType(record: CatalogExerciseType): ExerciseType {
  return {
    id: record.code,
    code: record.code,
    nameEn: record.name,
    descriptionEn: record.description,
  };
}

/**
 * ExerciseTypeManager component allows admins to manage exercise types.
 * Supports creating, updating, and deleting exercise types.
 */
export const ExerciseTypeManager: React.FC<ExerciseTypeManagerProps> = ({
  onTypeCreated,
  onTypeUpdated,
  onTypeDeleted,
}) => {
  const { t } = useTranslation("common");
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExerciseType | null>(null);
  const [formData, setFormData] = useState({ code: "", nameEn: "", descriptionEn: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTypes = async () => {
      setIsLoading(true);
      try {
        const data = await listExerciseTypes();
        if (!cancelled) {
          setTypes(data.map(toUiType));
        }
      } catch {
        if (!cancelled) {
          setTypes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = () => {
    setEditingType(null);
    setFormData({ code: "", nameEn: "", descriptionEn: "" });
    setIsModalOpen(true);
  };

  const handleEdit = (type: ExerciseType) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      nameEn: type.nameEn,
      descriptionEn: type.descriptionEn || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (editingType) {
        const updated = await updateExerciseType(editingType.code, {
          name: formData.nameEn,
          description: formData.descriptionEn || undefined,
        });
        const uiType = toUiType(updated);
        setTypes((prev) => prev.map((item) => (item.id === editingType.id ? uiType : item)));
        onTypeUpdated?.(uiType);
      } else {
        const created = await createExerciseType({
          code: formData.code,
          name: formData.nameEn,
          description: formData.descriptionEn || undefined,
        });
        const uiType = toUiType(created);
        setTypes((prev) => [...prev, uiType]);
        onTypeCreated?.(uiType);
      }
      setIsModalOpen(false);
      setFormData({ code: "", nameEn: "", descriptionEn: "" });
      setEditingType(null);
    } catch {
      // Error handling is owned by the parent / toast layer when wired.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.exerciseTypes.confirmDelete"))) {
      return;
    }

    try {
      await deleteExerciseType(id);
      setTypes((prev) => prev.filter((item) => item.id !== id));
      onTypeDeleted?.(id);
    } catch {
      // Error handling is owned by the parent / toast layer when wired.
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <CardTitle>{t("admin.exerciseTypes.title")}</CardTitle>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              leftIcon={<Plus size={16} />}
            >
              {t("admin.exerciseTypes.create")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}>
              <Spinner size="md" />
            </div>
          ) : types.length === 0 ? (
            <EmptyState
              title={t("admin.exerciseTypes.empty")}
              icon={<Database size={48} />}
              action={{
                label: t("admin.exerciseTypes.create"),
                onClick: handleCreate,
              }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {types.map((type) => (
                <div
                  key={type.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-md)",
                    background: "var(--color-bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--font-size-md)",
                        color: "var(--color-text-primary)",
                        marginBottom: "var(--space-xs)",
                      }}
                    >
                      {type.nameEn} ({type.code})
                    </div>
                    {type.descriptionEn && (
                      <div
                        style={{
                          fontSize: "var(--font-size-sm)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {type.descriptionEn}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(type)}
                      leftIcon={<Edit size={16} />}
                      aria-label={t("common.edit")}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        void handleDelete(type.id);
                      }}
                      leftIcon={<Trash2 size={16} />}
                      aria-label={t("common.delete")}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFormData({ code: "", nameEn: "", descriptionEn: "" });
          setEditingType(null);
        }}
        title={editingType ? t("admin.exerciseTypes.edit") : t("admin.exerciseTypes.create")}
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder={t("admin.exerciseTypes.codePlaceholder")}
            label={t("admin.exerciseTypes.code")}
            required
            disabled={Boolean(editingType)}
          />
          <Input
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            placeholder={t("admin.exerciseTypes.namePlaceholder")}
            label={t("admin.exerciseTypes.name")}
            required
          />
          <div>
            <label
              style={{
                display: "block",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                marginBottom: "var(--space-xs)",
                color: "var(--color-text-primary)",
              }}
            >
              {t("admin.exerciseTypes.description")}
            </label>
            <textarea
              value={formData.descriptionEn}
              onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
              placeholder={t("admin.exerciseTypes.descriptionPlaceholder")}
              rows={3}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-input-bg)",
                color: "var(--color-text-primary)",
                fontSize: "var(--font-size-md)",
                fontFamily: "var(--font-family-base)",
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)" }}>
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setFormData({ code: "", nameEn: "", descriptionEn: "" });
                setEditingType(null);
              }}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void handleSubmit();
              }}
              isLoading={isSubmitting}
            >
              {editingType ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
