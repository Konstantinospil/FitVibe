import React from "react";
import { Card, CardTitle } from "@fitvibe/ui";

export type TrainingStatus = "default" | "success" | "warning" | "danger";

type TrainingPanelProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  status?: TrainingStatus;
  footer?: React.ReactNode;
};

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  title,
  children,
  className = "",
  status = "default",
  footer,
}) => (
  <Card className={`training-panel ${className}`} variant="muted">
    <div className="training-panel__header">
      <CardTitle>{title}</CardTitle>
      <span className={`training-status-dot training-status-dot--${status}`} aria-hidden="true" />
    </div>
    <div className="training-panel__body">{children}</div>
    {footer ? <div className="training-panel__footer">{footer}</div> : null}
  </Card>
);

type TrainingSummaryCardProps = {
  title: React.ReactNode;
  meta?: React.ReactNode;
  supporting?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export const TrainingSummaryCard: React.FC<TrainingSummaryCardProps> = ({
  title,
  meta,
  supporting,
  trailing,
  className = "",
}) => (
  <Card className={`training-summary-card ${className}`} variant="surface">
    <div className="training-summary-card__copy">
      {meta ? <div className="training-summary-card__meta">{meta}</div> : null}
      <div className="training-summary-card__title">{title}</div>
    </div>
    {supporting ? <div className="training-summary-card__supporting">{supporting}</div> : null}
    {trailing ? <div className="training-summary-card__trailing">{trailing}</div> : null}
  </Card>
);
