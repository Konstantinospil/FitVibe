import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/components.css";
import "./styles/surfaces.css";
import { ensurePrivateTranslationsLoaded, minimalTranslationsReady } from "./i18n/config";
// Theme store is small and needed immediately to prevent FOUC
import { applyTheme, useThemeStore } from "./store/theme.store";
import { useAuthStore } from "./store/auth.store";
import {
  clearAuthenticatedPrefetch,
  startAuthenticatedPrefetch,
} from "./utils/authenticatedPrefetch";

// With a session, ProtectedRoutes will need the full bundle. Start it now, in
// parallel with the login strings, instead of after the app mounts (issue 634).
// This only downloads strings; ProtectedRoutes still gates on readiness.
if (useAuthStore.getState().isAuthenticated) {
  void ensurePrivateTranslationsLoaded().catch(() => undefined);
  // The preference and guard reads only need the session cookie. Start them
  // now instead of after the protected-route chunk and its i18n dependencies.
  startAuthenticatedPrefetch();
}

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
  // With a session, ProtectedRoutes registers every face once its content has
  // painted. Starting them here would put the downloads before that paint,
  // which is the LCP of authenticated pages.
  if (useAuthStore.getState().isAuthenticated) {
    useAuthStore.subscribe((state, previous) => {
      if (
        state.isAuthenticated !== previous.isAuthenticated ||
        state.user?.id !== previous.user?.id
      ) {
        // Early reads belong to the session the page started with.
        clearAuthenticatedPrefetch();
      }
      if (previous.isAuthenticated && !state.isAuthenticated) {
        // A stale or ended session never reaches ProtectedRoutes; keep public fonts.
        schedulePublicFonts();
      }
    });
  } else {
    schedulePublicFonts();
  }
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
// A streamed Suspense loading boundary is not a complete SSR application tree.
// Hydrating it as the finished route can leave fallback attributes on the live
// PageShell element. Mount a fresh React tree instead.
const isSsrLoadingFallback = Boolean(
  rootElement.querySelector('[data-ssr-loading-fallback="true"]'),
);
const hasSsrMarkup = rootElement.hasChildNodes() && !loginShell && !isSsrLoadingFallback;

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
