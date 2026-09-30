import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import VisibilityBadge from "../ui/VisibilityBadge";
import Skeleton from "../ui/Skeleton";

export interface PersonalBest {
  lift: string;
  value: string;
  achieved: string;
  visibility: "private" | "link" | "public";
}

export interface PersonalBestCardProps {
  records: PersonalBest[];
  loading?: boolean;
  emptyMessage?: string;
}

/**
 * PersonalBestCard component displays personal best records.
 * Shows lift, value, achievement date, and visibility.
 */
export const PersonalBestCard: React.FC<PersonalBestCardProps> = ({
  records,
  loading = false,
  emptyMessage,
}) => {
  const { t } = useTranslation("common");

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.personalBests")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex--column flex--gap-md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height="60px" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.personalBests")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex--center"
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {emptyMessage || "No personal bests recorded yet"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex--justify-between flex--align-center">
          <CardTitle>{t("dashboard.personalBests")}</CardTitle>
          <VisibilityBadge level="public" />
        </div>
      </CardHeader>
      <CardContent>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          {records.map((record, index) => (
            <li
              key={`${record.lift}-${record.value}-${index}`}
              className="flex flex--column flex--gap-xs"
            >
              <div className="flex flex--justify-between flex--align-center">
                <span>{record.lift}</span>
                <strong>{record.value}</strong>
              </div>
              <small className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {record.achieved}
              </small>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
