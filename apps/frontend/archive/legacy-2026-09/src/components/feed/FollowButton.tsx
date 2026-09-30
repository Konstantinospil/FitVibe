import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, UserMinus } from "lucide-react";
import { Button } from "../ui/Button";
import { followUser, unfollowUser } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface FollowButtonProps {
  userAlias: string;
  initialFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
}

/**
 * FollowButton component for following/unfollowing users.
 * Toggles follow state on click.
 */
export const FollowButton: React.FC<FollowButtonProps> = ({
  userAlias,
  initialFollowing = false,
  onFollowChange,
  size = "md",
  variant = "default",
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) {
      return;
    }

    const newFollowing = !isFollowing;

    // Optimistic update
    setIsFollowing(newFollowing);
    setIsLoading(true);

    try {
      if (newFollowing) {
        await followUser(userAlias);
      } else {
        await unfollowUser(userAlias);
      }
      onFollowChange?.(newFollowing);
      showToast({
        variant: newFollowing ? "success" : "info",
        title: newFollowing ? t("feed.follow.following") : t("feed.follow.unfollowed"),
      });
    } catch {
      // Revert on error
      setIsFollowing(!newFollowing);
      showToast({
        variant: "error",
        title: t("feed.follow.error.title"),
        message: t("feed.follow.error.message"),
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
      variant={isFollowing ? "secondary" : "primary"}
      size={size}
      onClick={(e) => {
        void handleClick(e);
      }}
      isLoading={isLoading}
      leftIcon={
        isFollowing ? (
          <UserMinus
            style={{
              width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
              height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            }}
          />
        ) : (
          <UserPlus
            style={{
              width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
              height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            }}
          />
        )
      }
      style={buttonStyle}
      aria-label={isFollowing ? t("feed.follow.unfollow") : t("feed.follow.follow")}
      aria-pressed={isFollowing}
    >
      {isFollowing ? t("feed.follow.unfollow") : t("feed.follow.follow")}
    </Button>
  );
};
