import React from "react";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../store/theme.store";
import { useThemeColors } from "../hooks/useThemeColors";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const colors = useThemeColors();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius-full)",
        color: colors.textSecondary,
        fontSize: "var(--type-supporting-size)",
        padding: "0.5rem 0.85rem",
        cursor: "pointer",
        transition: "background 150ms ease, color 150ms ease",
        gap: "0.5rem",
      }}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
