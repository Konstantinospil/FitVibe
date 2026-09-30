import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { Spinner } from "../ui/Spinner";
import { Tabs, TabsList, TabsTrigger } from "../ui/Tabs";
import {
  getLeaderboard,
  type LeaderboardEntry,
  type LeaderboardType,
  type LeaderboardPeriod,
} from "../../services/api";

export interface LeaderboardProps {
  defaultType?: LeaderboardType;
  defaultPeriod?: LeaderboardPeriod;
  showPeriodSelector?: boolean;
  limit?: number;
}

/**
 * Leaderboard component displays rankings for points.
 * Supports global and friends leaderboards with different time periods.
 */
export const Leaderboard: React.FC<LeaderboardProps> = ({
  defaultType = "global",
  defaultPeriod = "month",
  showPeriodSelector = true,
  limit = 100,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<LeaderboardType>(defaultType);
  const [period, setPeriod] = useState<LeaderboardPeriod>(defaultPeriod);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const response = await getLeaderboard({ type, period });
        setEntries(response.entries.slice(0, limit));
        setUserRank(response.userRank);
      } catch {
        // Error handling would be done by parent component
      } finally {
        setIsLoading(false);
      }
    };

    void loadLeaderboard();
  }, [type, period, limit]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return <Trophy size={20} style={{ color: "var(--color-warning)" }} />;
    }
    if (rank === 2) {
      return <Medal size={20} style={{ color: "var(--color-border-strong)" }} />;
    }
    if (rank === 3) {
      return <Award size={20} style={{ color: "var(--vibe-strength)" }} />;
    }
    return null;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) {
      return { background: "var(--surface-warning-subtle)" };
    }
    if (rank === 2) {
      return { background: "var(--border-subtle)" };
    }
    if (rank === 3) {
      return { background: "var(--surface-warning-subtle)" };
    }
    return {};
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gamification.leaderboard.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Tabs
            defaultValue={type}
            value={type}
            onValueChange={(val) => setType(val as LeaderboardType)}
          >
            <TabsList>
              <TabsTrigger value="global">{t("gamification.leaderboard.global")}</TabsTrigger>
              <TabsTrigger value="friends">{t("gamification.leaderboard.friends")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {showPeriodSelector && (
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              {(["week", "month", "year", "all"] as LeaderboardPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "var(--space-xs) var(--space-sm)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    background: period === p ? "var(--color-primary)" : "transparent",
                    color:
                      period === p ? "var(--color-text-primary-on)" : "var(--color-text-primary)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {t(`gamification.leaderboard.period.${p}`)}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-xl)" }}>
              <Spinner size="md" />
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                padding: "var(--space-xl)",
                textAlign: "center",
                color: "var(--color-text-secondary)",
              }}
            >
              {t("gamification.leaderboard.empty")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              {entries.map((entry) => (
                <div
                  key={entry.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-md)",
                    padding: "var(--space-md)",
                    borderRadius: "var(--radius-md)",
                    ...getRankStyle(entry.rank),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      fontWeight: 700,
                      fontSize: "var(--font-size-lg)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {getRankIcon(entry.rank) || entry.rank}
                  </div>
                  <Avatar
                    name={entry.displayName || entry.username}
                    src={entry.avatarUrl}
                    size={40}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "var(--font-size-md)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {entry.displayName || entry.username}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      @{entry.username}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "var(--font-size-lg)",
                        color: "var(--color-primary)",
                      }}
                    >
                      {entry.points.toLocaleString()}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {entry.badgesCount} {t("gamification.leaderboard.badges")}
                    </div>
                  </div>
                </div>
              ))}
              {userRank !== undefined && userRank > limit && (
                <div
                  style={{
                    padding: "var(--space-md)",
                    marginTop: "var(--space-sm)",
                    borderTop: "2px solid var(--color-border)",
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                    textAlign: "center",
                  }}
                >
                  {t("gamification.leaderboard.yourRank", { rank: userRank })}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
