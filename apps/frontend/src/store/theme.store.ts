import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Detect system preference (SSR-safe)
const getSystemTheme = (): Theme => {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
    return "dark"; // Default to dark theme on server
  }
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark"; // Fallback if matchMedia fails
  }
};

const getThemeMarkSrc = (theme: Theme): string =>
  theme === "light" ? "/fitvibe-mark-light.svg" : "/fitvibe-mark-dark.svg";

// Apply theme to document and theme-dependent brand assets
export const applyTheme = (theme: Theme) => {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = getThemeMarkSrc(theme);
    }
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: getSystemTheme(),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const newTheme = get().theme === "light" ? "dark" : "light";
        applyTheme(newTheme);
        set({ theme: newTheme });
      },
    }),
    {
      name: "fitvibe:theme",
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Apply theme on page load after rehydration
        if (state) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);
