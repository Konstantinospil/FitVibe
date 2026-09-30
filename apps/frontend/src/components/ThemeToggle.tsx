import React from "react";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "../store/theme.store";

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-surface-glass)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-full)",
  color: "var(--color-text-secondary)",
  fontSize: "var(--font-size-sm)",
  padding: "0.5rem 0.85rem",
  cursor: "pointer",
  transition: "background 150ms ease, color 150ms ease",
  gap: "0.5rem",
};

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      style={buttonStyle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export default ThemeToggle;
