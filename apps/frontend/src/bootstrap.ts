const PUBLIC_ROUTES = new Set<string>([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/login/verify-2fa",
  "/verify",
  "/terms",
  "/privacy",
  "/terms-reacceptance",
]);
const AUTH_STORAGE_KEY = "fitvibe:auth";

// SSR-safe: This script only runs in the browser (loaded from index.html)
// But add guards to prevent errors if somehow imported on server
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const normalizePath = (path: string) => {
    if (path.length > 1 && path.endsWith("/")) {
      return path.slice(0, -1);
    }
    return path;
  };

  const currentPath = normalizePath(window.location.pathname.toLowerCase());

  const hasSessionFlag = (() => {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return false;
    }
    return window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "1";
  })();

  // Always load React app for all routes - let React Router handle routing.
  // Keep the static login shell in place until React actually renders into #root.
  // Removing it here races minimalTranslationsReady in main.tsx and can create
  // a blank interval that pushes Largest Contentful Paint later.
  if (!hasSessionFlag && !PUBLIC_ROUTES.has(currentPath)) {
    // Redirect to login if not authenticated and not on a public route
    window.location.replace("/login");
  } else {
    // Font loading is scheduled by main.tsx. Keeping it out of bootstrap avoids
    // duplicate idle callbacks/imports on the initial critical rendering path.
    void import("./main");
  }
}

// Export to make this file a module for TypeScript
export {};
