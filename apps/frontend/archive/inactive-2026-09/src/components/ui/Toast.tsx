import React, { createContext, useState, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useToast as useAppToast } from "../../contexts/ToastContext";

export type ToastVariant = "success" | "info" | "warning" | "error";
export type ToastPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  showToast: (options: {
    variant?: ToastVariant;
    title?: string;
    message?: string;
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toastContainerStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 2000,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
  padding: "var(--space-lg)",
  pointerEvents: "none",
};

const positionStyles: Record<ToastPosition, React.CSSProperties> = {
  "top-left": {
    top: 0,
    left: 0,
  },
  "top-right": {
    top: 0,
    right: 0,
  },
  "bottom-left": {
    bottom: 0,
    left: 0,
  },
  "bottom-right": {
    bottom: 0,
    right: 0,
  },
};

const toastBaseStyle: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-xl)",
  boxShadow: "var(--shadow-e3)",
  padding: "var(--space-md) var(--space-lg)",
  minWidth: "20rem",
  maxWidth: "28rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-md)",
  pointerEvents: "auto",
  animation: "toast-slide-in 0.3s ease-out",
};

const variantStyles: Record<ToastVariant, React.CSSProperties> = {
  success: {
    borderLeft: "4px solid var(--color-success-border)",
  },
  info: {
    borderLeft: "4px solid var(--color-info-border)",
  },
  warning: {
    borderLeft: "4px solid var(--color-warning-border)",
  },
  error: {
    borderLeft: "4px solid var(--color-danger-border)",
  },
};

// Add keyframes if not already in global.css
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes toast-slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes toast-slide-out {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  if (!document.head.querySelector("style[data-toast-keyframes]")) {
    style.setAttribute("data-toast-keyframes", "true");
    document.head.appendChild(style);
  }
}

const ToastItem: React.FC<Toast & { onRemove: (id: string) => void }> = ({
  id,
  message,
  variant = "info",
  action,
  onRemove,
}) => {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        ...toastBaseStyle,
        ...variantStyles[variant],
      }}
      role="status"
      aria-live={variant === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div style={{ flex: 1, color: "var(--color-text-primary)" }}>{message}</div>
      <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-primary)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              padding: "var(--space-xs) var(--space-sm)",
              borderRadius: "var(--radius-md)",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-surface-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(id)}
          aria-label={t("close")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted)",
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
            e.currentTarget.style.color = "var(--color-text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-muted)";
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: ToastPosition;
}> = ({ children, position = "bottom-right" }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (options: { variant?: ToastVariant; title?: string; message?: string; duration?: number }) => {
      const message =
        options.title && options.message
          ? `${options.title}: ${options.message}`
          : options.message || options.title || "";
      addToast({
        message,
        variant: options.variant ?? "info",
        duration: options.duration,
      });
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            ...toastContainerStyle,
            ...positionStyles[position],
          }}
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} {...toast} onRemove={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const appToast = useAppToast();

  const showToast = useCallback(
    (options: { variant?: ToastVariant; title?: string; message?: string; duration?: number }) => {
      const message =
        options.title && options.message
          ? `${options.title}: ${options.message}`
          : options.message || options.title || "";
      appToast.showToast(options.variant ?? "info", message, options.duration);
    },
    [appToast],
  );

  return {
    showToast,
    success: appToast.success,
    error: appToast.error,
    warning: appToast.warning,
    info: appToast.info,
  };
};

export const useUiToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useUiToastContext must be used within ToastProvider");
  }
  return context;
};
