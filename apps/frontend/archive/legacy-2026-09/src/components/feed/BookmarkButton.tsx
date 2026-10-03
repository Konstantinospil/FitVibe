import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bookmark } from "lucide-react";
import { Button } from "../ui/Button";
import { bookmarkFeedItem, unbookmarkFeedItem } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface BookmarkButtonProps {
  feedItemId: string;
  initialBookmarked?: boolean;
  onBookmarkChange?: (bookmarked: boolean) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
}

/**
 * BookmarkButton component for bookmarking/unbookmarking feed items.
 * Toggles bookmark state on click.
 */
export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  feedItemId,
  initialBookmarked = false,
  onBookmarkChange,
  size = "md",
  variant = "default",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) {
      return;
    }

    const newBookmarked = !isBookmarked;

    // Optimistic update
    setIsBookmarked(newBookmarked);
    setIsLoading(true);

    try {
      if (newBookmarked) {
        await bookmarkFeedItem(feedItemId);
      } else {
        await unbookmarkFeedItem(feedItemId);
      }
      onBookmarkChange?.(newBookmarked);
      showToast({
        variant: newBookmarked ? "success" : "info",
        title: newBookmarked ? t("feed.bookmark.added") : t("feed.bookmark.removed"),
      });
    } catch {
      // Revert on error
      setIsBookmarked(!newBookmarked);
      showToast({
        variant: "error",
        title: t("feed.bookmark.error.title"),
        message: t("feed.bookmark.error.message"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyle: React.CSSProperties =
    variant === "minimal"
      ? {
          background: "transparent",
          border: "none",
          boxShadow: "none",
          padding: "0.5rem",
          minWidth: "auto",
        }
      : {};

  return (
    <Button
      variant={isBookmarked ? "primary" : "ghost"}
      size={size}
      onClick={(e) => {
        void handleClick(e);
      }}
      isLoading={isLoading}
      leftIcon={
        <Bookmark
          style={{
            fill: isBookmarked ? "var(--color-primary)" : "transparent",
            stroke: isBookmarked ? "var(--color-primary)" : "var(--color-text-secondary)",
            width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
          }}
        />
      }
      style={buttonStyle}
      aria-label={isBookmarked ? t("feed.bookmark.remove") : t("feed.bookmark.add")}
      aria-pressed={isBookmarked}
    />
  );
};
