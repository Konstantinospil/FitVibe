import React from "react";
import { Button } from "./Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
} from "./Card";
import { IconButton } from "./IconButton";
import { Switch } from "./Switch";
export type MessageTone = "info" | "warning" | "success" | "danger";
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export interface MessageCardProps extends Omit<CardProps, "children" | "title"> {
  tone?: MessageTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
}
export const MessageCard: React.FC<MessageCardProps> = ({
  tone = "info",
  title,
  description,
  icon,
  dismissLabel = "Dismiss",
  onDismiss,
  style,
  ...rest
}) => (
  <Card {...rest} data-component="message-card" data-tone={tone} style={style}>
    <div data-slot="message-layout">
      {icon ? (
        <span aria-hidden="true" data-slot="message-icon">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <div data-slot="card-copy">
        <strong data-slot="pattern-title-small">{title}</strong>
        {description ? <span data-slot="pattern-supporting">{description}</span> : null}
      </div>
      {onDismiss ? (
        <IconButton
          icon={<CloseIcon />}
          label={dismissLabel}
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          data-slot="message-dismiss"
        />
      ) : null}
    </div>
  </Card>
);

export interface WorkoutSummaryCardProps extends Omit<CardProps, "children" | "title"> {
  title: React.ReactNode;
  timestamp?: React.ReactNode;
  metricLabel?: React.ReactNode;
  metricValue?: React.ReactNode;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}
export const WorkoutSummaryCard: React.FC<WorkoutSummaryCardProps> = ({
  title,
  timestamp,
  metricLabel,
  metricValue,
  actionIcon,
  actionLabel = "Card action",
  onAction,
  style,
  ...rest
}) => (
  <Card {...rest} data-component="workout-summary-card" style={style}>
    <CardHeader>
      <div data-slot="card-copy">
        <CardTitle>{title}</CardTitle>
        {timestamp ? <CardDescription>{timestamp}</CardDescription> : null}
      </div>
      {actionIcon && onAction ? (
        <IconButton
          icon={actionIcon}
          label={actionLabel}
          variant="ghost"
          size="sm"
          onClick={onAction}
        />
      ) : actionIcon ? (
        <span aria-hidden="true" data-slot="summary-icon">
          {actionIcon}
        </span>
      ) : null}
    </CardHeader>
    {metricLabel || metricValue ? (
      <CardContent>
        <span data-slot="pattern-supporting">{metricLabel}</span>
        <strong data-slot="secondary-metric">{metricValue}</strong>
      </CardContent>
    ) : null}
  </Card>
);

export interface MetricCardProps extends Omit<CardProps, "children"> {
  label?: React.ReactNode;
  value: React.ReactNode;
  supportingText?: React.ReactNode;
  action?: React.ReactNode;
}
export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  supportingText,
  action,
  style,
  ...rest
}) => (
  <Card {...rest} data-component="metric-card" style={style}>
    <CardContent>
      {label ? <span data-slot="pattern-supporting">{label}</span> : null}
      <div data-slot="metric-row" data-has-action={action ? true : undefined}>
        <strong data-slot="primary-metric">{value}</strong>
        {action}
      </div>
      {supportingText ? <CardDescription>{supportingText}</CardDescription> : null}
    </CardContent>
  </Card>
);

export interface EventCardProps extends Omit<CardProps, "children" | "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  explanation?: React.ReactNode;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
}
export const EventCard: React.FC<EventCardProps> = ({
  title,
  subtitle,
  icon,
  children,
  explanation,
  actionLabel,
  onAction,
  style,
  ...rest
}) => (
  <Card
    {...rest}
    variant="muted"
    data-component="event-card"
    data-has-icon={icon ? true : undefined}
    style={style}
  >
    <CardHeader>
      {icon ? (
        <span aria-hidden="true" data-slot="event-icon">
          {icon}
        </span>
      ) : null}
      <div data-slot="card-copy">
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </div>
    </CardHeader>
    {children ? <CardContent>{children}</CardContent> : null}
    {explanation || (actionLabel && onAction) ? (
      <CardFooter>
        {explanation ? <span data-slot="event-explanation">{explanation}</span> : null}
        {actionLabel && onAction ? (
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardFooter>
    ) : null}
  </Card>
);

export interface ConsentCardProps extends Omit<CardProps, "children" | "title" | "onChange"> {
  category?: React.ReactNode;
  requiredLabel?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}
export const ConsentCard: React.FC<ConsentCardProps> = ({
  category,
  requiredLabel,
  title,
  description,
  checked,
  defaultChecked,
  disabled,
  onChange,
  style,
  ...rest
}) => (
  <Card {...rest} data-component="consent-card" style={style}>
    <CardContent>
      {category ? <span data-slot="consent-category">{category}</span> : null}
      {requiredLabel ? <strong data-slot="consent-required">{requiredLabel}</strong> : null}
      <div data-slot="consent-row">
        <div data-slot="card-copy">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <Switch
          aria-label={typeof title === "string" ? title : "Consent"}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </CardContent>
  </Card>
);
