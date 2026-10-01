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

const messageToneStyles: Record<
  MessageTone,
  { border: string; color: string; background: string }
> = {
  info: {
    border: "var(--color-info-border)",
    color: "var(--color-info-text)",
    background: "var(--color-surface)",
  },
  warning: {
    border: "var(--color-warning-border)",
    color: "var(--color-warning-text)",
    background: "var(--color-surface)",
  },
  success: {
    border: "var(--color-success-border)",
    color: "var(--color-success-text)",
    background: "var(--color-surface)",
  },
  danger: {
    border: "var(--color-danger-border)",
    color: "var(--color-danger-text)",
    background: "var(--color-surface)",
  },
};

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ width: "100%", height: "100%" }}>
    <path
      d="m6 6 12 12M18 6 6 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
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
}) => {
  const toneStyle = messageToneStyles[tone];

  return (
    <Card
      {...rest}
      data-component="message-card"
      data-tone={tone}
      style={{
        borderColor: toneStyle.border,
        background: toneStyle.background,
        boxShadow: "none",
        ...style,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          gap: "var(--space-sm)",
          alignItems: "start",
          padding: "var(--space-sm)",
        }}
      >
        {icon ? (
          <span
            aria-hidden="true"
            data-slot="message-icon"
            style={{
              color: toneStyle.color,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </span>
        ) : (
          <span aria-hidden="true" />
        )}

        <div style={{ display: "grid", gap: "var(--space-xs)" }}>
          <strong
            style={{
              fontFamily: "var(--font-family-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--type-supporting-size)",
              lineHeight: "var(--type-supporting-line-height)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </strong>
          {description ? (
            <span
              style={{
                fontFamily: "var(--font-family-body)",
                fontWeight: "var(--font-weight-regular)",
                fontSize: "var(--type-supporting-size)",
                lineHeight: "var(--type-supporting-line-height)",
                color: "var(--color-text-secondary)",
              }}
            >
              {description}
            </span>
          ) : null}
        </div>

        {onDismiss ? (
          <IconButton
            icon={<CloseIcon />}
            label={dismissLabel}
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            style={{ color: toneStyle.color }}
          />
        ) : null}
      </div>
    </Card>
  );
};

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
  <Card {...rest} data-component="workout-summary-card" style={{ boxShadow: "none", ...style }}>
    <CardHeader
      style={{
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "start",
      }}
    >
      <div style={{ display: "grid", gap: "var(--space-xs)" }}>
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
      <CardContent
        style={{
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          paddingTop: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-family-body)",
            fontSize: "var(--type-supporting-size)",
            lineHeight: "var(--type-supporting-line-height)",
            color: "var(--color-text-secondary)",
          }}
        >
          {metricLabel}
        </span>
        <strong
          style={{
            fontFamily: "var(--font-family-heading)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "var(--type-secondary-metric-size)",
            lineHeight: "var(--type-secondary-metric-line-height)",
            letterSpacing: "var(--type-secondary-metric-letter-spacing)",
            color: "var(--color-text-primary)",
          }}
        >
          {metricValue}
        </strong>
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
  <Card {...rest} data-component="metric-card" style={{ boxShadow: "none", ...style }}>
    <CardContent>
      {label ? (
        <span
          style={{
            fontFamily: "var(--font-family-body)",
            fontSize: "var(--type-supporting-size)",
            lineHeight: "var(--type-supporting-line-height)",
            color: "var(--color-text-secondary)",
          }}
        >
          {label}
        </span>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: action ? "minmax(0, 1fr) auto" : "minmax(0, 1fr)",
          gap: "var(--space-sm)",
          alignItems: "center",
        }}
      >
        <strong
          style={{
            fontFamily: "var(--font-family-heading)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "var(--type-primary-metric-size)",
            lineHeight: "var(--type-primary-metric-line-height)",
            letterSpacing: "var(--type-primary-metric-letter-spacing)",
            color: "var(--color-text-primary)",
          }}
        >
          {value}
        </strong>
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
    style={{ boxShadow: "none", ...style }}
  >
    <CardHeader
      style={{
        gridTemplateColumns: icon ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)",
        alignItems: "center",
      }}
    >
      {icon ? (
        <span aria-hidden="true" data-slot="event-icon">
          {icon}
        </span>
      ) : null}
      <div style={{ display: "grid", gap: "var(--space-xs)" }}>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </div>
    </CardHeader>

    {children ? <CardContent>{children}</CardContent> : null}

    {explanation || (actionLabel && onAction) ? (
      <CardFooter>
        {explanation ? (
          <span
            style={{
              marginRight: "auto",
              fontFamily: "var(--font-family-body)",
              fontSize: "var(--type-supporting-size)",
              lineHeight: "var(--type-supporting-line-height)",
              color: "var(--color-text-secondary)",
            }}
          >
            {explanation}
          </span>
        ) : null}
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
  <Card {...rest} data-component="consent-card" style={{ boxShadow: "none", ...style }}>
    <CardContent>
      {category ? (
        <span
          style={{
            fontFamily: "var(--font-family-body)",
            fontSize: "var(--type-supporting-size)",
            lineHeight: "var(--type-supporting-line-height)",
            color: "var(--color-text-muted)",
          }}
        >
          {category}
        </span>
      ) : null}

      {requiredLabel ? (
        <strong
          style={{
            fontFamily: "var(--font-family-body)",
            fontWeight: "var(--font-weight-semibold)",
            fontSize: "var(--type-supporting-size)",
            lineHeight: "var(--type-supporting-line-height)",
            color: "var(--color-text-primary)",
          }}
        >
          {requiredLabel}
        </strong>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "var(--space-sm)",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-xs)" }}>
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
