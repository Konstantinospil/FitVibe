import React from "react";
import { useTranslation } from "react-i18next";
import { Award, Lock } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Badge as BadgeType } from "../../services/api";

export interface BadgeCardProps {
  badge: BadgeType;
  onClick?: () => void;
  showProgress?: boolean;
}

/**
 * BadgeCard component displays a single badge with its details.
 * Shows progress if the badge is not yet earned.
 */
export const BadgeCard: React.FC<BadgeCardProps> = ({ badge, onClick, showProgress = true }) => {
  const { t } = useTranslation();
  const isEarned = !!badge.earnedAt;
  const progress =
    badge.progress && badge.maxProgress
      ? Math.min(100, (badge.progress / badge.maxProgress) * 100)
      : 0;

  const rarityColors: Record<string, string> = {
    common: "var(--color-text-secondary)",
    rare: "var(--color-info)",
    epic: "var(--color-primary)",
    legendary: "var(--color-warning)",
  };

  return (
    <Card
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        opacity: isEarned ? 1 : 0.6,
        position: "relative",
      }}
    >
      <CardContent>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-md)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: isEarned
                ? "linear-gradient(135deg, var(--color-primary), var(--color-secondary))"
                : "var(--color-bg-secondary)",
              border: `3px solid ${badge.rarity ? rarityColors[badge.rarity] : "var(--color-border)"}`,
            }}
          >
            {badge.iconUrl ? (
              <img
                src={badge.iconUrl}
                alt={badge.name}
                style={{ width: "60%", height: "60%", objectFit: "contain" }}
              />
            ) : (
              <Award
                size={40}
                style={{
                  color: isEarned ? "var(--color-text-primary-on)" : "var(--color-text-secondary)",
                }}
              />
            )}
            {!isEarned && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(0, 0, 0, 0.7)",
                  borderRadius: "50%",
                  padding: "var(--space-xs)",
                }}
              >
                <Lock size={20} style={{ color: "var(--color-text-primary-on)" }} />
              </div>
            )}
          </div>
          <div style={{ width: "100%" }}>
            <h3
              style={{
                margin: "0 0 var(--space-xs) 0",
                fontSize: "var(--font-size-md)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {badge.name}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: "var(--line-height-relaxed)",
              }}
            >
              {badge.description}
            </p>
            {badge.rarity && (
              <div style={{ marginTop: "var(--space-sm)" }}>
                <Badge variant="info" size="sm">
                  {t(`gamification.badges.rarity.${badge.rarity}`)}
                </Badge>
              </div>
            )}
            {showProgress && !isEarned && badge.progress !== undefined && (
              <div style={{ marginTop: "var(--space-sm)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                    marginBottom: "var(--space-xs)",
                  }}
                >
                  <span>{t("gamification.badges.progress")}</span>
                  <span>
                    {badge.progress} / {badge.maxProgress || 0}
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    background: "var(--color-bg-secondary)",
                    borderRadius: "var(--radius-full)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background:
                        "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}
            {isEarned && badge.earnedAt && (
              <div
                style={{
                  marginTop: "var(--space-sm)",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {t("gamification.badges.earned")} {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
