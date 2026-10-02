import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "@fitvibe/ui";

export interface ModalProps {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  width?: "sm" | "md" | "lg";
}

const maxWidthBySize = {
  sm: "var(--modal-width-sm)",
  md: "var(--modal-width-md)",
  lg: "var(--modal-width-lg)",
} as const;

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  description,
  children,
  footer,
  closeLabel = "Close",
  onClose,
  closeOnBackdrop = true,
  width = "md",
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-component="modal-layer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: "var(--space-md)",
        background: "var(--dialog-backdrop)",
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-component="modal"
        style={{
          width: "min(100%, " + maxWidthBySize[width] + ")",
          maxHeight: "calc(100vh - var(--space-2xl))",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          overflow: "hidden",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--dialog-shadow)",
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: "var(--space-md)",
            alignItems: "start",
            padding: "var(--space-md)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "grid", gap: "var(--space-xs)" }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-family-heading)",
                fontWeight: "var(--font-weight-semibold)",
                fontSize: "var(--type-card-title-size)",
                lineHeight: "var(--type-card-title-line-height)",
                letterSpacing: "var(--type-card-title-letter-spacing)",
              }}
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-family-body)",
                  fontWeight: "var(--font-weight-regular)",
                  fontSize: "var(--type-supporting-size)",
                  lineHeight: "var(--type-supporting-line-height)",
                  letterSpacing: "var(--type-supporting-letter-spacing)",
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            icon={<X aria-hidden="true" />}
            label={closeLabel}
            size="md"
            onClick={onClose}
          />
        </header>

        <div
          className="fitvibe-scrollbar"
          style={{
            minHeight: 0,
            overflow: "auto",
            padding: "var(--space-md)",
          }}
        >
          {children}
        </div>

        {footer ? (
          <footer
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--space-sm)",
              padding: "var(--space-md)",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
};
