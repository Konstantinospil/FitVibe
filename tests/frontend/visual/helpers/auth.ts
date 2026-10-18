import type { Page } from "@playwright/test";
import type { VisualTheme } from "./project.js";

const AUTH_STORAGE_KEY = "fitvibe:auth";
const THEME_STORAGE_KEY = "fitvibe:theme";

/**
 * Seeds sessionStorage so bootstrap.ts and the auth store treat the tab as signed in.
 */
export async function setupAuthenticatedState(page: Page): Promise<void> {
  await page.addInitScript((key: string) => {
    window.sessionStorage.setItem(key, "1");
  }, AUTH_STORAGE_KEY);
}

export async function clearAuthenticatedState(page: Page): Promise<void> {
  await page.evaluate((key: string) => {
    window.sessionStorage.removeItem(key);
  }, AUTH_STORAGE_KEY);
}

/**
 * Persist theme before the app boots so data-theme matches the Playwright project.
 */
export async function seedTheme(page: Page, theme: VisualTheme): Promise<void> {
  await page.addInitScript(
    ({ storageKey, themeName }: { storageKey: string; themeName: VisualTheme }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ state: { theme: themeName }, version: 1 }),
      );
      const apply = () => {
        const root = document.documentElement;
        if (!root) {
          return false;
        }
        root.setAttribute("data-theme", themeName);
        return true;
      };
      if (apply()) {
        return;
      }
      const observer = new MutationObserver(() => {
        if (apply()) {
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    },
    { storageKey: THEME_STORAGE_KEY, themeName: theme },
  );
}

/**
 * Navigates to a page with authentication setup.
 */
export async function gotoAuthenticated(
  page: Page,
  url: string,
  options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" },
): Promise<void> {
  await setupAuthenticatedState(page);
  await page.goto(url, { waitUntil: options?.waitUntil || "domcontentloaded" });
}
