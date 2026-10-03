import React from "react";
import { useTranslation } from "react-i18next";
import type { FeedItem } from "../../services/api";
import { TrainingSummaryCard } from "./TrainingSurface";

export type HomeFeedCardProps = {
  item: FeedItem;
};

const HomeFeedCard: React.FC<HomeFeedCardProps> = ({ item }) => {
  const { t, i18n } = useTranslation();

  const name = item.user.displayName || item.user.username;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const published = item.publishedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(item.publishedAt))
    : t("homeSurface.news.unpublished");

  return (
    <TrainingSummaryCard
      className="home-feed-card"
      meta={published}
      title={
        <div className="home-feed-card__identity">
          <span className="home-feed-card__avatar" aria-hidden="true">
            {initial}
          </span>
          <span>{item.session.title || t("homeSurface.session.workout")}</span>
        </div>
      }
      supporting={
        item.session.notes ||
        t("homeSurface.news.sharedBy", {
          name,
        })
      }
      trailing={
        <div className="home-feed-card__footer">
          <span className="home-feed-card__comments">
            {t("homeSurface.news.comments", {
              count: item.commentsCount,
            })}
          </span>
        </div>
      }
    />
  );
};

export default HomeFeedCard;
