import React from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, XCircle } from "lucide-react";
import { BUTTON_ICON_SIZES, Button } from "@fitvibe/ui";
import { FormFeedback, type FeedbackTone } from "./FormStack";

export type StatusKind = "loading" | "success" | "warning" | "error";

export interface StatusPanelProps {
  kind: StatusKind;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export interface RetryErrorPanelProps {
  message: React.ReactNode;
  retryLabel: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

const toneByKind: Record<StatusKind, FeedbackTone> = {
  loading: "info",
  success: "success",
  warning: "warning",
  error: "danger",
};

const iconByKind = {
  loading: LoaderCircle,
  success: CheckCircle2,
  warning: CircleAlert,
  error: XCircle,
} as const;

export const StatusPanel: React.FC<StatusPanelProps> = ({ kind, children, actions }) => {
  const Icon = iconByKind[kind];

  return (
    <div
      data-component="status-panel"
      data-kind={kind}
      style={{
        display: "grid",
        justifyItems: "center",
        gap: "var(--space-md)",
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: BUTTON_ICON_SIZES.lg,
          height: BUTTON_ICON_SIZES.lg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color:
            kind === "success"
              ? "var(--color-success-text)"
              : kind === "warning"
                ? "var(--color-warning-text)"
                : kind === "error"
                  ? "var(--color-danger-text)"
                  : "var(--color-info-text)",
        }}
      >
        <Icon
          style={{
            width: "100%",
            height: "100%",
            animation: kind === "loading" ? "spin 1s linear infinite" : undefined,
          }}
        />
      </span>
      {children ? <FormFeedback tone={toneByKind[kind]}>{children}</FormFeedback> : null}
      {actions ? (
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
};

export const RetryErrorPanel: React.FC<RetryErrorPanelProps> = ({
  message,
  retryLabel,
  onRetry,
  isRetrying = false,
}) => (
  <StatusPanel
    kind="error"
    actions={
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onRetry}
        isLoading={isRetrying}
        disabled={isRetrying}
      >
        {retryLabel}
      </Button>
    }
  >
    {message}
  </StatusPanel>
);
