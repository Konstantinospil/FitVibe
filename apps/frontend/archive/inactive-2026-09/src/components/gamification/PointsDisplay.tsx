import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { getPointsBalance } from "../../services/api";
import type { PointsBalance } from "../../services/api";

export interface PointsDisplayProps {
  showRecentEvents?: boolean;
  onLoad?: (balance: PointsBalance) => void;
}

/**
 * PointsDisplay component shows the user's current points balance.
 * Optionally displays recent point events.
 */
export const PointsDisplay: React.FC<PointsDisplayProps> = ({
  showRecentEvents = false,
  onLoad,
}) => {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBalance = async () => {
      setIsLoading(true);
      try {
        const data = await getPointsBalance();
        setBalance(data);
        onLoad?.(data);
      } catch {
        // Error handling would be done by parent component or error boundary
      } finally {
        setIsLoading(false);
      }
    };

    void loadBalance();
  }, [onLoad]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-lg)" }}>
            <Spinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
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
            }}
          >
            <Trophy size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-xs)",
              }}
            >
              {t("gamification.points.total")}
            </div>
            <div
              style={{
                fontSize: "var(--font-size-2xl)",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                lineHeight: 1,
              }}
            >
              {balance.total.toLocaleString()}
            </div>
          </div>
        </div>
        {showRecentEvents && balance.recentEvents && balance.recentEvents.length > 0 && (
          <div
            style={{
              marginTop: "var(--space-md)",
              paddingTop: "var(--space-md)",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                marginBottom: "var(--space-sm)",
                color: "var(--color-text-primary)",
              }}
            >
              {t("gamification.points.recent")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              {balance.recentEvents.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "var(--font-size-sm)",
                  }}
                >
                  <span style={{ color: "var(--color-text-secondary)" }}>{event.description}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: event.points > 0 ? "var(--color-success)" : "var(--color-danger)",
                    }}
                  >
                    {event.points > 0 ? "+" : ""}
                    {event.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
