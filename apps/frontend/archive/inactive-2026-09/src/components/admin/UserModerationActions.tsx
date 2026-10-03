import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserX, UserCheck, Ban } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { suspendUser, unsuspendUser, banUser } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface UserModerationActionsProps {
  userId: string;
  currentStatus: "active" | "suspended" | "banned";
  onActionComplete?: () => void;
}

/**
 * UserModerationActions component provides actions for moderating users.
 * Supports suspend, unsuspend, and ban actions.
 */
export const UserModerationActions: React.FC<UserModerationActionsProps> = ({
  userId,
  currentStatus,
  onActionComplete,
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [action, setAction] = useState<"suspend" | "unsuspend" | "ban" | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = (actionType: "suspend" | "unsuspend" | "ban") => {
    setAction(actionType);
    setIsModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!action) {
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (action === "suspend") {
        await suspendUser(userId, payload);
      } else if (action === "unsuspend") {
        await unsuspendUser(userId, payload);
      } else if (action === "ban") {
        await banUser(userId, payload);
      }

      showToast({
        variant: "success",
        title: t("admin.users.actionSuccess"),
        message: t("admin.users.actionMessage", { action }),
      });
      setIsModalOpen(false);
      setAction(null);
      setReason("");
      setNotes("");
      onActionComplete?.();
    } catch {
      showToast({
        variant: "error",
        title: t("admin.users.actionError"),
        message: t("admin.users.actionErrorMessage"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const actionLabels: Record<string, string> = {
    suspend: t("admin.users.suspend"),
    unsuspend: t("admin.users.unsuspend"),
    ban: t("admin.users.ban"),
  };

  return (
    <>
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        {currentStatus === "active" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAction("suspend")}
            leftIcon={<UserX size={16} />}
          >
            {t("admin.users.suspend")}
          </Button>
        )}
        {currentStatus === "suspended" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleAction("unsuspend")}
            leftIcon={<UserCheck size={16} />}
          >
            {t("admin.users.unsuspend")}
          </Button>
        )}
        {currentStatus !== "banned" && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleAction("ban")}
            leftIcon={<Ban size={16} />}
          >
            {t("admin.users.ban")}
          </Button>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setAction(null);
          setReason("");
          setNotes("");
        }}
        title={t("admin.users.confirmAction", { action: action ? actionLabels[action] : "" })}
        size="md"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
            {t("admin.users.confirmMessage", { action: action ? actionLabels[action] : "" })}
          </p>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.users.reasonPlaceholder")}
            label={t("admin.users.reason")}
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
              {t("admin.users.notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("admin.users.notesPlaceholder")}
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
                setReason("");
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
