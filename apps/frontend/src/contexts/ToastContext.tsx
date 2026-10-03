import React, { createContext, useState, useContext, useCallback } from "react";
// Tree-shakeable imports from lucide-react - only import used icons
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = `${Date.now()}-${Math.random()}`;
      const toast: Toast = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast],
  );

  const contextValue: ToastContextValue = {
    showToast,
    success: (message, duration) => showToast("success", message, duration),
    error: (message, duration) => showToast("error", message, duration),
    warning: (message, duration) => showToast("warning", message, duration),
    info: (message, duration) => showToast("info", message, duration),
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--space-md)",
        right: "var(--space-md)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        maxWidth: "420px",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const config = {
    success: {
      icon: CheckCircle,
      bg: "var(--toast-success-bg)",
      border: "var(--toast-success-border)",
      color: "var(--toast-success-icon)",
    },
    error: {
      icon: XCircle,
      bg: "var(--toast-error-bg)",
      border: "var(--toast-error-border)",
      color: "var(--toast-error-icon)",
    },
    warning: {
      icon: AlertCircle,
      bg: "var(--toast-warning-bg)",
      border: "var(--toast-warning-border)",
      color: "var(--toast-warning-icon)",
    },
    info: {
      icon: Info,
      bg: "var(--toast-info-bg)",
      border: "var(--toast-info-border)",
      color: "var(--toast-info-icon)",
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-md)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-sm)",
        boxShadow: "var(--toast-shadow)",
        animation: "slideIn 0.2s ease-out",
      }}
    >
      <Icon size={20} color={config.color} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: "var(--font-size-toast)",
          color: "var(--toast-text)",
        }}
      >
        {toast.message}
      </p>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "0.25rem",
          color: "var(--color-text-secondary)",
          display: "flex",
          alignItems: "center",
          transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--color-text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--color-text-secondary)";
        }}
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}
      </style>
    </div>
  );
};
