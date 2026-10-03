import React from "react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * EmptyState component displays a message when there's no content to show.
 * Supports icon, title, message, and optional action button.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, icon, action }) => {
  return (
    <Card>
      <CardContent>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-xl)",
            textAlign: "center",
            gap: "var(--space-md)",
          }}
        >
          {icon && (
            <div
              style={{
                fontSize: "48px",
                color: "var(--color-text-muted)",
                marginBottom: "var(--space-sm)",
              }}
            >
              {icon}
            </div>
          )}
          <h3
            style={{
              margin: 0,
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </h3>
          {message && (
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-md)",
                color: "var(--color-text-secondary)",
                lineHeight: "var(--line-height-relaxed)",
                maxWidth: "400px",
              }}
            >
              {message}
            </p>
          )}
          {action && (
            <Button variant="primary" size="md" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
