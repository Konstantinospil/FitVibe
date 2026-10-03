import React from "react";
import { useTranslation } from "react-i18next";

export type AlertVariant = "success" | "error" | "warning" | "info" | "danger";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, React.CSSProperties> = {
  success: {
    background: "var(--color-success-bg)",
    color: "var(--color-success-text)",
    borderColor: "var(--color-success-border)",
  },
  info: {
    background: "var(--color-info-bg)",
    color: "var(--color-info-text)",
    borderColor: "var(--color-info-border)",
  },
  warning: {
    background: "var(--color-warning-bg)",
    color: "var(--color-warning-text)",
    borderColor: "var(--color-warning-border)",
  },
  danger: {
    background: "var(--color-danger-bg)",
    color: "var(--color-danger-text)",
    borderColor: "var(--color-danger-border)",
  },
  error: {
    background: "var(--color-danger-bg)",
    color: "var(--color-danger-text)",
    borderColor: "var(--color-danger-border)",
  },
};

const baseStyle: React.CSSProperties = {
  padding: "var(--space-md) var(--space-lg)",
  borderRadius: "var(--radius-xl)",
  border: "1px solid",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-xs)",
};

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
  style,
  ...props
}) => {
  const { t } = useTranslation("common");
  const isAssertive = variant === "danger" || variant === "warning";

  const computedStyle: React.CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...style,
  };

  return (
    <div
      className={className}
      style={computedStyle}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      {...props}
    >
      <div className="flex flex--justify-between flex--align-center">
        {title && (
          <h3
            className="text-md"
            style={{
              margin: 0,
              fontWeight: 600,
              color: "inherit",
            }}
          >
            {title}
          </h3>
        )}
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("close")}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "var(--space-xs)",
              marginLeft: "var(--space-md)",
              opacity: 0.7,
              transition: "opacity 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.7";
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ color: "inherit" }}>{children}</div>
    </div>
  );
};
