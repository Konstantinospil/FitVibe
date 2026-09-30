import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { Button } from "../ui/Button";
import { likeFeedItem, unlikeFeedItem } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface LikeButtonProps {
  feedItemId: string;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
}

/**
 * LikeButton component for liking/unliking feed items.
 * Displays like count and toggles like state on click.
 */
export const LikeButton: React.FC<LikeButtonProps> = ({
  feedItemId,
  initialLiked = false,
  initialCount = 0,
  onLikeChange,
  size = "md",
  variant = "default",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) {
      return;
    }

    const newLiked = !isLiked;
    const newCount = newLiked ? count + 1 : Math.max(0, count - 1);

    // Optimistic update
    setIsLiked(newLiked);
    setCount(newCount);
    setIsLoading(true);

    try {
      if (newLiked) {
        await likeFeedItem(feedItemId);
      } else {
        await unlikeFeedItem(feedItemId);
      }
      onLikeChange?.(newLiked, newCount);
    } catch {
      // Revert on error
      setIsLiked(!newLiked);
      setCount(newCount === count + 1 ? count : count + 1);
      showToast({
        variant: "error",
        title: t("feed.like.error.title"),
        message: t("feed.like.error.message"),
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
      variant={isLiked ? "primary" : "ghost"}
      size={size}
      onClick={(e) => {
        void handleClick(e);
      }}
      isLoading={isLoading}
      leftIcon={
        <Heart
          style={{
            fill: isLiked ? "var(--color-primary)" : "transparent",
            stroke: isLiked ? "var(--color-primary)" : "var(--color-text-secondary)",
            width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
          }}
        />
      }
      style={buttonStyle}
      aria-label={isLiked ? t("feed.like.unlike") : t("feed.like.like")}
      aria-pressed={isLiked}
    >
      {count > 0 && <span>{count}</span>}
    </Button>
  );
};
