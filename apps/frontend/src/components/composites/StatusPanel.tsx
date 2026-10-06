import React from "react";
import { CheckCircle2, CircleAlert, LoaderCircle, XCircle } from "lucide-react";
import { Button } from "@fitvibe/ui";
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
    <div data-component="status-panel" data-kind={kind}>
      <span aria-hidden="true" data-slot="status-icon">
        <Icon />
      </span>
      {children ? <FormFeedback tone={toneByKind[kind]}>{children}</FormFeedback> : null}
      {actions ? <div data-slot="status-actions">{actions}</div> : null}
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
