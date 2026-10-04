import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { useThemeStore } from "../store/theme.store";

export type ThemeToggleVariant = "default" | "header";

type ThemeToggleProps = {
  variant?: ThemeToggleVariant;
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = "default" }) => {
  const { theme, toggleTheme } = useThemeStore();
  const isHeader = variant === "header";
  const actionLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  if (isHeader) {
    return (
      <IconButton
        icon={theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        label={actionLabel}
        variant="ghost"
        size="lg"
        onClick={toggleTheme}
        data-control="theme-toggle"
        data-theme={theme}
      />
    );
  }

  return (
    <Button
      variant="secondary"
      size="md"
      type="button"
      onClick={toggleTheme}
      aria-label={actionLabel}
      title={actionLabel}
      data-control="theme-toggle"
      data-theme={theme}
      leftIcon={theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    >
      {actionLabel}
    </Button>
  );
};

export default ThemeToggle;
