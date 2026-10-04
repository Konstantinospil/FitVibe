import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../ui/Card";
import { Avatar } from "../ui/Avatar";
import { FollowButton } from "./FollowButton";
import type { UserProfile } from "../../services/api";

export interface UserCardProps {
  user: UserProfile;
  onFollowChange?: (following: boolean) => void;
  showFollowButton?: boolean;
  onClick?: () => void;
}

/**
 * UserCard component displays user profile information in a card format.
 * Shows avatar, username, display name, bio, and follower counts.
 */
export const UserCard: React.FC<UserCardProps> = ({
  user,
  onFollowChange,
  showFollowButton = true,
  onClick,
}) => {
  const { t } = useTranslation("common");

  return (
    <Card
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <CardContent>
        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            alignItems: "flex-start",
          }}
        >
          <Avatar
            name={user.displayName || user.username}
            src={user.avatarUrl ?? undefined}
            size={56}
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
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-lg)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {user.displayName || user.username}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  @{user.username}
                </p>
              </div>
              {showFollowButton && !user.isOwnProfile && user.alias && (
                <FollowButton
                  userAlias={user.alias}
                  initialFollowing={user.isFollowing}
                  onFollowChange={onFollowChange}
                  size="sm"
                  variant="default"
                />
              )}
            </div>
            {user.bio && (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                  lineHeight: "var(--line-height-relaxed)",
                }}
              >
                {user.bio}
              </p>
            )}
            {(user.followersCount !== undefined || user.followingCount !== undefined) && (
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-md)",
                  marginTop: "var(--space-xs)",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {user.followersCount !== undefined && (
                  <span>
                    <strong style={{ color: "var(--color-text-primary)" }}>
                      {user.followersCount}
                    </strong>{" "}
                    {t("feed.user.followers")}
                  </span>
                )}
                {user.followingCount !== undefined && (
                  <span>
                    <strong style={{ color: "var(--color-text-primary)" }}>
                      {user.followingCount}
                    </strong>{" "}
                    {t("feed.user.following")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
