import type React from "react";
import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { IconButton } from "@fitvibe/ui";
import { CustomScrollbar } from "../CustomScrollbar";

export interface ModalProps {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
  width?: "sm" | "md" | "lg";
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  description,
  children,
  footer,
  closeLabel,
  onClose,
  closeOnBackdrop = true,
  width = "md",
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) {
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

  // Conditional children such as `{flag ? <p /> : null}` leave only nulls;
  // an empty body would still take its padding and show as a blank band.
  const hasBody = React.Children.toArray(children).length > 0;

  return (
    <div
      data-component="modal-layer"
      onClick={(event) => {
        if (onClose && closeOnBackdrop && event.target === event.currentTarget) {
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
        data-size={width}
      >
        <header data-slot="modal-header">
          <div data-slot="modal-copy">
            <h2 id={titleId} data-slot="modal-title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} data-slot="modal-description">
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <IconButton
              icon={<X aria-hidden="true" />}
              label={closeLabel ?? t("common.close")}
              size="md"
              onClick={onClose}
            />
          ) : null}
        </header>
        {hasBody ? (
          <CustomScrollbar data-slot="modal-body" label={t("scrollbar.dialogLabel")}>
            {children}
          </CustomScrollbar>
        ) : null}
        {footer ? <footer data-slot="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
};
