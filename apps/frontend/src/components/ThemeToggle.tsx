import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@fitvibe/ui";
import { useThemeStore } from "../store/theme.store";

export type ThemeToggleVariant = "default" | "header";

type ThemeToggleProps = {
  variant?: ThemeToggleVariant;
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = "default" }) => {
  const { theme, toggleTheme } = useThemeStore();
  const [hovered, setHovered] = useState(false);
  const isHeader = variant === "header";
  const actionLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={toggleTheme}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={actionLabel}
      title={actionLabel}
      data-control="theme-toggle"
      data-theme={theme}
      style={{
        minWidth: isHeader ? "44px" : "auto",
        minHeight: isHeader ? "44px" : "40px",
        padding: isHeader ? "var(--space-xs)" : "var(--space-xs) var(--space-sm)",
        borderRadius: isHeader ? "var(--radius-md)" : "var(--radius-full)",
        border: isHeader ? "none" : "1px solid var(--color-border)",
        background: hovered
          ? "var(--color-surface-muted)"
          : isHeader
            ? "none"
            : "var(--color-surface-glass)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-family-body)",
        fontSize: "var(--type-control-size)",
        lineHeight: "var(--type-control-line-height)",
      }}
    >
      {theme === "dark" ? <Moon size={22} /> : <Sun size={22} />}
    </Button>
  );
};

export default ThemeToggle;
