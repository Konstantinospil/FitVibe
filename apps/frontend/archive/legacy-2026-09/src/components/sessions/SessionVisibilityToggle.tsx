import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import VisibilityBadge from "../ui/VisibilityBadge";
import { Eye, EyeOff, Link as LinkIcon } from "lucide-react";
import type { SessionVisibility } from "@fitvibe/contracts";

export type VisibilityLevel = SessionVisibility;

export interface SessionVisibilityToggleProps {
  value: VisibilityLevel;
  onChange: (value: VisibilityLevel) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

/**
 * SessionVisibilityToggle component for changing session visibility.
 * Supports private, followers, link, and public visibility levels.
 */
export const SessionVisibilityToggle: React.FC<SessionVisibilityToggleProps> = ({
  value,
  onChange,
  disabled = false,
  isLoading = false,
}) => {
  const { t } = useTranslation("common");

  const visibilityOptions: Array<{ value: VisibilityLevel; icon: React.ReactNode; label: string }> =
    [
      {
        value: "private",
        icon: <EyeOff size={16} />,
        label: t("visibility.labels.private"),
      },
      {
        value: "followers",
        icon: <Eye size={16} />,
        label: t("visibility.labels.followers") || "Followers",
      },
      {
        value: "link",
        icon: <LinkIcon size={16} />,
        label: t("visibility.labels.link"),
      },
      {
        value: "public",
        icon: <Eye size={16} />,
        label: t("visibility.labels.public"),
      },
    ];

  return (
    <div className="flex flex--gap-sm" style={{ flexWrap: "wrap" }}>
      {visibilityOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "primary" : "ghost"}
          size="sm"
          onClick={() => onChange(option.value)}
          disabled={disabled || isLoading}
          leftIcon={option.icon}
        >
          {option.label}
        </Button>
      ))}
      <VisibilityBadge level={value} />
    </div>
  );
};
