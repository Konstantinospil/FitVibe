import React from "react";
import { useTranslation } from "react-i18next";
import { Calendar, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { LikeButton } from "./LikeButton";
import { BookmarkButton } from "./BookmarkButton";
import { ShareButton } from "./ShareButton";
import { CloneSessionButton } from "./CloneSessionButton";
import VisibilityBadge from "../ui/VisibilityBadge";
import type { FeedItem } from "../../services/api";

export interface FeedSessionCardProps {
  item: FeedItem;
  onLikeChange?: (liked: boolean, count: number) => void;
  onBookmarkChange?: (bookmarked: boolean) => void;
  onShareLinkCreated?: (url: string) => void;
  onCloneSuccess?: (newSessionId: string) => void;
  onUserClick?: (userId: string) => void;
  onSessionClick?: (sessionId: string) => void;
}

/**
 * FeedSessionCard component displays a session from the feed.
 * Shows user info, session details, and social interaction buttons.
 */
export const FeedSessionCard: React.FC<FeedSessionCardProps> = ({
  item,
  onLikeChange,
  onBookmarkChange,
  onShareLinkCreated,
  onCloneSuccess,
  onUserClick,
  onSessionClick,
}) => {
  const { t } = useTranslation("common");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t("feed.timestamp.momentsAgo");
    }
    if (diffMins < 60) {
      return t("feed.timestamp.minutesAgo", { count: diffMins });
    }
    if (diffHours < 24) {
      return t("feed.timestamp.hoursAgo", { count: diffHours });
    }
    if (diffDays < 7) {
      return t("feed.timestamp.daysAgo", { count: diffDays });
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    }).format(date);
  };

  return (
    <Card
      onClick={onSessionClick ? () => onSessionClick(item.session.id) : undefined}
      style={{
        cursor: onSessionClick ? "pointer" : "default",
      }}
    >
      <CardHeader>
        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            alignItems: "flex-start",
          }}
        >
          <Avatar
            name={item.user.displayName || item.user.username}
            src={undefined} // Avatar URL would come from user profile
            size={40}
            onClick={onUserClick ? () => onUserClick(item.user.id) : undefined}
            style={{
              cursor: onUserClick ? "pointer" : "default",
            }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "var(--space-md)",
              }}
            >
              <div>
                <CardTitle
                  style={{
                    fontSize: "var(--font-size-md)",
                    marginBottom: "var(--space-xs)",
                  }}
                >
                  {item.user.displayName || item.user.username}
                </CardTitle>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  @{item.user.username} • {formatDate(item.publishedAt || item.createdAt)}
                </p>
              </div>
              <VisibilityBadge level={item.visibility as "private" | "link" | "public"} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {item.session.title && (
          <h3
            style={{
              margin: "0 0 var(--space-sm) 0",
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {item.session.title}
          </h3>
        )}
        {item.session.notes && (
          <p
            style={{
              margin: "0 0 var(--space-md) 0",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              lineHeight: "var(--line-height-relaxed)",
            }}
          >
            {item.session.notes}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: "var(--space-sm)",
            alignItems: "center",
            marginBottom: "var(--space-md)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          {item.session.plannedAt && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-xs)",
              }}
            >
              <Calendar size={16} />
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(item.session.plannedAt))}
            </div>
          )}
          {item.session.exerciseCount > 0 && (
            <span>
              {item.session.exerciseCount}{" "}
              {item.session.exerciseCount === 1 ? t("feed.exercise") : t("feed.exercises")}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "var(--space-md)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-sm)",
              alignItems: "center",
            }}
          >
            <LikeButton
              feedItemId={item.feedItemId}
              initialLiked={item.isLiked}
              initialCount={item.likesCount}
              onLikeChange={onLikeChange}
              size="sm"
              variant="minimal"
            />
            {item.commentsCount > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-xs)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <MessageCircle size={16} />
                <span>{item.commentsCount}</span>
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-xs)",
              alignItems: "center",
            }}
          >
            <BookmarkButton
              feedItemId={item.feedItemId}
              initialBookmarked={item.isBookmarked}
              onBookmarkChange={onBookmarkChange}
              size="sm"
              variant="minimal"
            />
            <ShareButton
              feedItemId={item.feedItemId}
              sessionId={item.session.id}
              onShareLinkCreated={onShareLinkCreated}
              size="sm"
              variant="minimal"
            />
            <CloneSessionButton
              sessionId={item.session.id}
              onCloneSuccess={onCloneSuccess}
              size="sm"
              variant="minimal"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
