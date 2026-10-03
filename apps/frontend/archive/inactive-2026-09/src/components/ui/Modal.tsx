import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FocusTrap } from "../a11y/FocusTrap";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const sizeStyles: Record<"sm" | "md" | "lg" | "xl", React.CSSProperties> = {
  sm: { maxWidth: "28rem" },
  md: { maxWidth: "32rem" },
  lg: { maxWidth: "48rem" },
  xl: { maxWidth: "64rem" },
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--color-bg)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "var(--space-lg)",
};

const modalStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  borderRadius: "var(--radius-xl)",
  border: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-e3)",
  width: "100%",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "var(--space-lg) var(--space-xl)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-md)",
};

const contentStyle: React.CSSProperties = {
  padding: "var(--space-lg) var(--space-xl)",
  overflowY: "auto",
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: "var(--space-md) var(--space-xl)",
  borderTop: "1px solid var(--color-border)",
  display: "flex",
  justifyContent: "flex-end",
  gap: "var(--space-sm)",
};

/**
 * Modal component with focus trap and accessibility support.
 * Implements WCAG 2.2 AA requirements for modals.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  ...props
}) => {
  const { t } = useTranslation("common");
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      style={overlayStyle}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        style={{
          ...modalStyle,
          ...sizeStyles[size],
        }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        <FocusTrap active={isOpen} initialFocus={showCloseButton ? closeButtonRef : undefined}>
          {(title || showCloseButton) && (
            <header style={headerStyle}>
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg"
                  style={{
                    margin: 0,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                    padding: "var(--space-xs)",
                    borderRadius: "var(--radius-md)",
                    transition: "background-color 150ms ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-surface-muted)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>×</span>
                </button>
              )}
            </header>
          )}
          {description && (
            <p
              id="modal-description"
              className="text-sm"
              style={{
                margin: 0,
                padding: "var(--space-md) var(--space-xl)",
                color: "var(--color-text-muted)",
              }}
            >
              {description}
            </p>
          )}
          <div style={contentStyle}>{children}</div>
        </FocusTrap>
      </div>
    </div>
  );
};

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, ...props }) => {
  return (
    <footer style={footerStyle} {...props}>
      {children}
    </footer>
  );
};
