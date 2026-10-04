import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import type { Badge } from "../../services/api";

export interface AchievementNotificationProps {
  badge: Badge;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  dismissDelay?: number;
}

/**
 * AchievementNotification component displays a notification when a badge is earned.
 * Can be auto-dismissed or manually dismissed.
 */
export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  badge,
  onDismiss,
  autoDismiss = true,
  dismissDelay = 5000,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, dismissDelay);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, dismissDelay, isVisible, onDismiss]);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <Card
      style={{
        position: "fixed",
        top: "var(--space-lg)",
        right: "var(--space-lg)",
        zIndex: 9999,
        minWidth: "320px",
        maxWidth: "400px",
        animation: "slideInRight 0.3s ease-out",
        boxShadow: "var(--shadow-e3)",
      }}
    >
      <div
        style={{
          padding: "var(--space-lg)",
          display: "flex",
          gap: "var(--space-md)",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))",
            color: "var(--color-text-primary-on)",
            flexShrink: 0,
          }}
        >
          {badge.iconUrl ? (
            <img
              src={badge.iconUrl}
              alt={badge.name}
              style={{ width: "60%", height: "60%", objectFit: "contain" }}
            />
          ) : (
            <Award size={24} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-xs)",
            }}
          >
            {t("gamification.achievement.earned")}
          </div>
          <div
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              marginBottom: "var(--space-xs)",
            }}
          >
            {badge.name}
          </div>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              lineHeight: "var(--line-height-relaxed)",
            }}
          >
            {badge.description}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          leftIcon={<X size={16} />}
          aria-label={t("common.close")}
          style={{
            padding: "0.25rem",
            minWidth: "auto",
            flexShrink: 0,
          }}
        />
      </div>
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </Card>
  );
};
