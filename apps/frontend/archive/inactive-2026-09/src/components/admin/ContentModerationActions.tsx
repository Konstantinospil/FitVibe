import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeOff, X, Ban } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { moderateContent, type ModerateContentRequest } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface ContentModerationActionsProps {
  reportId: string;
  onActionComplete?: () => void;
}

/**
 * ContentModerationActions component provides actions for moderating reported content.
 * Supports hide, dismiss, and ban actions.
 */
export const ContentModerationActions: React.FC<ContentModerationActionsProps> = ({
  reportId,
  onActionComplete,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [action, setAction] = useState<"hide" | "dismiss" | "ban" | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = (actionType: "hide" | "dismiss" | "ban") => {
    setAction(actionType);
    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!action) {
      return;
    }

    setIsLoading(true);
    try {
      const payload: ModerateContentRequest = {
        action,
        notes: notes.trim() || undefined,
      };
      await moderateContent(reportId, payload);
      showToast({
        variant: "success",
        title: t("admin.moderation.actionSuccess"),
        message: t("admin.moderation.actionMessage", { action }),
      });
      setIsModalOpen(false);
      setAction(null);
      setNotes("");
      onActionComplete?.();
    } catch {
      showToast({
        variant: "error",
        title: t("admin.moderation.actionError"),
        message: t("admin.moderation.actionErrorMessage"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const actionLabels: Record<string, string> = {
    hide: t("admin.moderation.hide"),
    dismiss: t("admin.moderation.dismiss"),
    ban: t("admin.moderation.ban"),
  };

  return (
    <>
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            handleAction("hide");
          }}
          leftIcon={<EyeOff size={16} />}
        >
          {t("admin.moderation.hide")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleAction("dismiss");
          }}
          leftIcon={<X size={16} />}
        >
          {t("admin.moderation.dismiss")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            handleAction("ban");
          }}
          leftIcon={<Ban size={16} />}
        >
          {t("admin.moderation.ban")}
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setAction(null);
          setNotes("");
        }}
        title={t("admin.moderation.confirmAction", { action: action ? actionLabels[action] : "" })}
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            {t("admin.moderation.confirmMessage", { action: action ? actionLabels[action] : "" })}
          </p>
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
              {t("admin.moderation.notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("admin.moderation.notesPlaceholder")}
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
                setAction(null);
                setNotes("");
              }}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant={action === "ban" ? "danger" : "primary"}
              onClick={() => {
                void handleConfirm();
              }}
              isLoading={isLoading}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
