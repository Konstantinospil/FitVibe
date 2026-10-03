import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { BadgeCard } from "./BadgeCard";
import { Spinner } from "../ui/Spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/Tabs";
import { getUserBadges, getBadgeCatalog, type Badge } from "../../services/api";

export interface BadgeDisplayProps {
  showCatalog?: boolean;
  onBadgeClick?: (badge: Badge) => void;
}

/**
 * BadgeDisplay component shows user's earned badges and the badge catalog.
 * Supports tabbed view for earned vs. all badges.
 */
export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ showCatalog = true, onBadgeClick }) => {
  const { t } = useTranslation();
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [catalogBadges, setCatalogBadges] = useState<Badge[]>([]);
  const [isLoadingEarned, setIsLoadingEarned] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [activeTab, setActiveTab] = useState<"earned" | "catalog">("earned");

  useEffect(() => {
    const loadEarned = async () => {
      setIsLoadingEarned(true);
      try {
        const response = await getUserBadges();
        setEarnedBadges(response.badges);
      } catch {
        // Error handling would be done by parent component
      } finally {
        setIsLoadingEarned(false);
      }
    };

    void loadEarned();
  }, []);

  const loadCatalog = async () => {
    if (catalogBadges.length > 0) {
      return;
    } // Already loaded

    setIsLoadingCatalog(true);
    try {
      const response = await getBadgeCatalog();
      setCatalogBadges(response.badges);
    } catch {
      // Error handling would be done by parent component
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "earned" | "catalog");
    if (value === "catalog" && catalogBadges.length === 0) {
      void loadCatalog();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gamification.badges.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {showCatalog ? (
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="earned">
                {t("gamification.badges.earned")} ({earnedBadges.length})
              </TabsTrigger>
              <TabsTrigger value="catalog">{t("gamification.badges.catalog")}</TabsTrigger>
            </TabsList>
            <TabsContent value="earned">
              {isLoadingEarned ? (
                <div
                  style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}
                >
                  <Spinner size="md" />
                </div>
              ) : earnedBadges.length === 0 ? (
                <div
                  style={{
                    padding: "var(--space-xl)",
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {t("gamification.badges.noBadges")}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "var(--space-md)",
                    marginTop: "var(--space-md)",
                  }}
                >
                  {earnedBadges.map((badge) => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      onClick={() => onBadgeClick?.(badge)}
                      showProgress={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="catalog">
              {isLoadingCatalog ? (
                <div
                  style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}
                >
                  <Spinner size="md" />
                </div>
              ) : catalogBadges.length === 0 ? (
                <div
                  style={{
                    padding: "var(--space-xl)",
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {t("gamification.badges.noCatalog")}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "var(--space-md)",
                    marginTop: "var(--space-md)",
                  }}
                >
                  {catalogBadges.map((badge) => (
                    <BadgeCard
                      key={badge.id}
                      badge={badge}
                      onClick={() => onBadgeClick?.(badge)}
                      showProgress={true}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {isLoadingEarned ? (
              <div
                style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}
              >
                <Spinner size="md" />
              </div>
            ) : earnedBadges.length === 0 ? (
              <div
                style={{
                  padding: "var(--space-xl)",
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                }}
              >
                {t("gamification.badges.noBadges")}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "var(--space-md)",
                }}
              >
                {earnedBadges.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    onClick={() => onBadgeClick?.(badge)}
                    showProgress={false}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
