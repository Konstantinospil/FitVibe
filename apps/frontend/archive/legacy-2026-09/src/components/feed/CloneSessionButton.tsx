import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { cloneSessionFromFeed } from "../../services/api";
import { useToast } from "../ui/Toast";

export interface CloneSessionButtonProps {
  sessionId: string;
  onCloneSuccess?: (newSessionId: string) => void;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal";
}

/**
 * CloneSessionButton component for cloning sessions from the feed.
 * Creates a copy of the session for the current user.
 */
export const CloneSessionButton: React.FC<CloneSessionButtonProps> = ({
  sessionId,
  onCloneSuccess,
  size = "md",
  variant = "default",
}) => {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await cloneSessionFromFeed(sessionId);
      showToast({
        variant: "success",
        title: t("feed.clone.success"),
        message: t("feed.clone.message"),
      });
      onCloneSuccess?.(response.sessionId);
    } catch {
      showToast({
        variant: "error",
        title: t("feed.clone.error.title"),
        message: t("feed.clone.error.message"),
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
      variant="secondary"
      size={size}
      onClick={(e) => {
        void handleClick(e);
      }}
      isLoading={isLoading}
      leftIcon={
        <Copy
          style={{
            width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
          }}
        />
      }
      style={buttonStyle}
      aria-label={t("feed.clone.clone")}
    >
      {variant === "default" && t("feed.clone.clone")}
    </Button>
  );
};
