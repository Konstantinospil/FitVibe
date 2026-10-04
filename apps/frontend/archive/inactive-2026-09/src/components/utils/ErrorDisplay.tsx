import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: "default" | "compact";
}

/**
 * ErrorDisplay component shows error messages with optional retry action.
 * Supports different variants for different use cases.
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title,
  message,
  onRetry,
  variant = "default",
}) => {
  if (variant === "compact") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          padding: "var(--space-md)",
          background: "var(--color-danger-bg)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-danger-border)",
        }}
      >
        <AlertTriangle size={20} style={{ color: "var(--color-danger)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-danger)",
            flex: 1,
          }}
        >
          {message}
        </span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={16} />}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <Alert variant="danger" title={title || "Error"}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-sm)" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "0.125rem" }} />
          <span>{message}</span>
        </div>
      </Alert>
      {onRetry && (
        <div>
          <Button variant="primary" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={16} />}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
