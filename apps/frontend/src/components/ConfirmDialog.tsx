import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@fitvibe/ui";
import { Modal } from "./composites/Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  onConfirm,
  onCancel,
}) => {
  const toneColor =
    variant === "danger"
      ? "var(--color-danger-text)"
      : variant === "warning"
        ? "var(--color-warning-text)"
        : "var(--color-info-text)";

  return (
    <Modal
      open={isOpen}
      title={title}
      onClose={onCancel}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          gap: "var(--space-md)",
          alignItems: "start",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            color: toneColor,
          }}
        >
          <AlertTriangle />
        </span>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-family-body)",
            fontWeight: "var(--font-weight-regular)",
            fontSize: "var(--type-body-size)",
            lineHeight: "var(--type-body-line-height)",
            letterSpacing: "var(--type-body-letter-spacing)",
          }}
        >
          {message}
        </p>
      </div>
    </Modal>
  );
};
