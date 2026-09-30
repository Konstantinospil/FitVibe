import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";

export interface BackButtonProps {
  to?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  label?: string;
}

/**
 * BackButton component for navigation back functionality.
 * Supports programmatic navigation or browser history.
 */
export const BackButton: React.FC<BackButtonProps> = ({
  to,
  onClick,
  variant = "ghost",
  size = "md",
  label,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      void navigate(to);
    } else {
      void navigate(-1);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      leftIcon={<ArrowLeft size={18} />}
      aria-label={label || t("navigation.back") || "Go back"}
    >
      {label || t("navigation.back") || "Back"}
    </Button>
  );
};
