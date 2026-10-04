import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
// Suppress console errors in production for Lighthouse compliance
import "./utils/suppressConsole";
import { minimalTranslationsReady } from "./i18n/config";
// Theme store is small and needed immediately to prevent FOUC
import { applyTheme, useThemeStore } from "./store/theme.store";

const schedulePublicFonts = (): void => {
  const load = (): void => {
    void import("./utils/fontLoader").then(({ loadPublicFonts }) => {
      loadPublicFonts();
    });
  };
  if (typeof window === "undefined") {
    return;
  }
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load, { timeout: 4000 });
    return;
  }
  setTimeout(load, 2000);
};

// Initialize theme on app load (SSR-safe)
// This is synchronous to prevent flash of unstyled content
if (typeof document !== "undefined") {
  const initialTheme = useThemeStore.getState().theme;
  applyTheme(initialTheme);
  schedulePublicFonts();
}

// Hydrate the server-rendered HTML
// Use hydrateRoot for SSR, which will match the server-rendered content
// SSR-safe: Only access document in browser
if (typeof document === "undefined") {
  throw new Error("Document is not available - this code should only run in the browser");
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The static #login-shell in index.html is a no-JS fallback, not SSR output.
// Hydrating the SPA over that markup never matches and leaves the fallback on screen.
const loginShell = document.getElementById("login-shell");
const hasSsrMarkup = rootElement.hasChildNodes() && !loginShell;

const mount = (): void => {
  if (hasSsrMarkup) {
    hydrateRoot(rootElement, app);
    return;
  }
  createRoot(rootElement).render(app);
};

// Keep SSR HTML (the LCP heading) on screen until auth strings are ready so
// hydration cannot replace the title with untranslated keys.
void minimalTranslationsReady.then(mount);
