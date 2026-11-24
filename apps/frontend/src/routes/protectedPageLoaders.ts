/**
 * Shared dynamic-import loaders for the authenticated route tree (issue 634).
 *
 * `React.lazy` and the early prefetch in `bootstrap.ts` must call the *same*
 * loader so the browser downloads each chunk once and `lazy` reuses the
 * in-flight promise instead of starting a second, later request.
 *
 * This module only holds import thunks. It must stay free of React, stores and
 * application state because `bootstrap.ts` imports it before the app loads.
 */

type ModuleWithDefault = { default: unknown };

export function memoizeImport<T extends ModuleWithDefault>(
  load: () => Promise<T>,
): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = load().catch((error: unknown) => {
        // A failed chunk request (e.g. offline) must be retryable on the next
        // render instead of permanently caching the rejection.
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

export const loadProtectedRoutes = memoizeImport(() => import("./ProtectedRoutes"));
export const loadHome = memoizeImport(() => import("../pages/Home"));
export const loadCalendar = memoizeImport(() => import("../pages/Calendar"));
export const loadLibrary = memoizeImport(() => import("../pages/Library"));
export const loadDashboard = memoizeImport(() => import("../pages/Dashboard"));
export const loadSettings = memoizeImport(() => import("../pages/Settings"));
export const loadTerms = memoizeImport(() => import("../pages/Terms"));
export const loadPrivacy = memoizeImport(() => import("../pages/Privacy"));
export const loadCookie = memoizeImport(() => import("../pages/Cookie"));
export const loadTermsReacceptance = memoizeImport(() => import("../pages/TermsReacceptance"));
export const loadAdminPasswordUpdate = memoizeImport(() => import("../pages/AdminPasswordUpdate"));

const PAGE_LOADERS_BY_PATH: Readonly<Record<string, () => Promise<ModuleWithDefault>>> = {
  "/": loadHome,
  "/calendar": loadCalendar,
  "/library": loadLibrary,
  "/dashboard": loadDashboard,
  "/settings": loadSettings,
  "/terms": loadTerms,
  "/privacy": loadPrivacy,
  "/cookie": loadCookie,
  "/terms-reacceptance": loadTermsReacceptance,
  "/admin/password-update": loadAdminPasswordUpdate,
};

function normalizePath(pathname: string): string {
  const lower = pathname.toLowerCase();
  return lower.length > 1 && lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

/**
 * Starts downloading the authenticated route tree and the page for `pathname`
 * in parallel with the main bundle. This only fetches code: it renders nothing
 * and bypasses no guard, because every page still renders below ProtectedRoute.
 */
export function prefetchProtectedEntry(pathname: string): void {
  const swallow = () => undefined;
  void loadProtectedRoutes().catch(swallow);
  const loadPage = PAGE_LOADERS_BY_PATH[normalizePath(pathname)];
  if (loadPage) {
    void loadPage().catch(swallow);
  }
}
