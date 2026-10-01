import React, { useState } from "react";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import nodIcon from "../../assets/nod.svg";
import {
  likeFeedItem,
  unlikeFeedItem,
  type FeedItem,
} from "../../services/api";
import { logger } from "../../utils/logger";
import { TrainingSummaryCard } from "../composites/TrainingSurface";

export type HomeFeedCardProps = {
  item: FeedItem;
};

const HomeFeedCard: React.FC<HomeFeedCardProps> = ({ item }) => {
  const { t, i18n } = useTranslation();
  const [nodded, setNodded] = useState(Boolean(item.isLiked));
  const [nodCount, setNodCount] = useState(item.likesCount);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const name = item.user.displayName || item.user.username;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const published = item.publishedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(item.publishedAt))
    : t("homeSurface.news.unpublished");

  const toggleNod = async () => {
    if (pending) {
      return;
    }

    const previousNodded = nodded;
    const previousCount = nodCount;
    const nextNodded = !previousNodded;

    setPending(true);
    setErrorMessage(null);
    setNodded(nextNodded);
    setNodCount(Math.max(0, previousCount + (nextNodded ? 1 : -1)));

    try {
      if (nextNodded) {
        await likeFeedItem(item.feedItemId);
      } else {
        await unlikeFeedItem(item.feedItemId);
      }
    } catch (error) {
      setNodded(previousNodded);
      setNodCount(previousCount);
      setErrorMessage(t("homeSurface.news.nodError"));
      logger.apiError(
        "Failed to update feed nod",
        error,
        `/api/v1/feed/item/${item.feedItemId}/like`,
        nextNodded ? "POST" : "DELETE",
      );
    } finally {
      setPending(false);
    }
  };

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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<img className="home-feed-card__nod-icon" src={nodIcon} alt="" />}
            aria-pressed={nodded}
            aria-label={
              nodded
                ? t("homeSurface.news.removeNod")
                : t("homeSurface.news.addNod")
            }
            disabled={pending}
            onClick={() => {
              void toggleNod();
            }}
          >
            {nodCount}
          </Button>
          <span className="home-feed-card__comments">
            {t("homeSurface.news.comments", {
              count: item.commentsCount,
            })}
          </span>
          {errorMessage ? (
            <span className="training-inline-error" role="alert">
              {errorMessage}
            </span>
          ) : null}
        </div>
      }
    />
  );
};

export default HomeFeedCard;
