import React, { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../lib/queryClient";
import i18n, { ensurePrivateTranslationsLoaded, loadLanguageTranslations } from "../i18n/config";
import { getUserPreferences } from "../services/api";
import { takePrefetched } from "../utils/authenticatedPrefetch";
import { readDehydratedStateFromDocument } from "../ssr/dehydratedState";
// The guard (~1 KB) and layout (~2 KB) are on every authenticated route.
// Importing them eagerly removes two sequential chunk round trips from the
// critical path and means nothing above the guard can suspend, so a pending
// page chunk can never discard a settled guard (issue 634).
import ProtectedRoute from "../components/ProtectedRoute";
import MainLayout from "../layouts/MainLayout";
import {
  loadAdminPasswordUpdate,
  loadCalendar,
  loadCookie,
  loadDashboard,
  loadHome,
  loadLibrary,
  loadPrivacy,
  loadSettings,
  loadTerms,
  loadTermsReacceptance,
} from "./protectedPageLoaders";

const Home = lazy(loadHome);
const Calendar = lazy(loadCalendar);
const Library = lazy(loadLibrary);
const Dashboard = lazy(loadDashboard);
const Settings = lazy(loadSettings);
const Terms = lazy(loadTerms);
const Privacy = lazy(loadPrivacy);
const Cookie = lazy(loadCookie);
const TermsReacceptance = lazy(loadTermsReacceptance);
const AdminPasswordUpdate = lazy(loadAdminPasswordUpdate);

// `data-ssr-loading-fallback` tells main.tsx that server HTML is incomplete and
// must be mounted fresh rather than hydrated, for both fallbacks.
const fallback = (
  <div
    className="flex h-screen w-full items-center justify-center text-primary-500"
    data-ssr-loading-fallback="true"
    role="status"
    aria-live="polite"
  >
    {i18n.t("loading.app")}
  </div>
);

// Page chunks usually arrive before the guard settles (bootstrap.ts prefetches
// the current route), so this rarely shows. When it does, it fills only the
// content area inside MainLayout instead of replacing the whole screen.
const pageFallback = (
  <div
    className="flex min-h-[50vh] w-full items-center justify-center text-primary-500"
    data-ssr-loading-fallback="true"
    role="status"
    aria-live="polite"
  >
    {i18n.t("loading.app")}
  </div>
);

const page = (element: React.ReactElement) => (
  <Suspense fallback={pageFallback}>{element}</Suspense>
);

type ProtectedRoutesProps = {
  queryClient?: QueryClient;
  dehydratedState?: DehydratedState;
};

function getDehydratedState(): DehydratedState | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  return readDehydratedStateFromDocument(document);
}

const ProtectedRoutes: React.FC<ProtectedRoutesProps> = ({
  queryClient = defaultQueryClient,
  dehydratedState: propDehydratedState,
}) => {
  const [translationsReady, setTranslationsReady] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        // Both operations are independent. Start them together, but keep
        // protected content gated until the authoritative language is ready.
        const [translations, preferencesResult] = await Promise.allSettled([
          ensurePrivateTranslationsLoaded(),
          takePrefetched("preferences", getUserPreferences),
        ]);
        if (translations.status === "rejected") {
          throw translations.reason;
        }
        if (preferencesResult.status === "rejected") {
          throw preferencesResult.reason;
        }
        const preferences = preferencesResult.value;
        // The account preference is authoritative after authentication (ADR-031).
        // The browser language remains a fallback if preferences cannot be fetched.
        if (!active) {
          return;
        }
        await loadLanguageTranslations(preferences.language);
        if (!active) {
          return;
        }
        await i18n.changeLanguage(preferences.language);
      } catch {
        // A preference read failure must not prevent access to protected routes.
      } finally {
        if (active) {
          setTranslationsReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Authenticated pages re-render their content in the signed-in layout, and
  // that paint is their LCP. Font downloads that start earlier sit on the LCP
  // critical path even though font-display never blocks it, so register the
  // faces after the content has painted (two frames after the commit).
  useEffect(() => {
    if (!translationsReady) {
      return;
    }
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        void import("../utils/fontLoader").then(({ loadPublicFonts, loadAppFonts }) => {
          loadPublicFonts();
          loadAppFonts();
        });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [translationsReady]);

  const dehydratedState = propDehydratedState ?? getDehydratedState();

  // Every lazy element has its own boundary below ProtectedRoute/MainLayout.
  // The outer boundary is only a safety net; nothing above the guard suspends.
  const routesContent = (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="admin/password-update" element={page(<AdminPasswordUpdate />)} />
          <Route element={<MainLayout />}>
            <Route index element={page(<Home />)} />
            <Route path="calendar" element={page(<Calendar />)} />
            <Route path="library" element={page(<Library />)} />
            <Route path="dashboard" element={page(<Dashboard />)} />
            <Route path="settings" element={page(<Settings />)} />
            <Route path="terms" element={page(<Terms />)} />
            <Route path="privacy" element={page(<Privacy />)} />
            <Route path="cookie" element={page(<Cookie />)} />
            <Route path="terms-reacceptance" element={page(<TermsReacceptance />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );

  return (
    <QueryClientProvider client={queryClient}>
      {!translationsReady ? (
        fallback
      ) : dehydratedState ? (
        <HydrationBoundary state={dehydratedState}>{routesContent}</HydrationBoundary>
      ) : (
        routesContent
      )}
    </QueryClientProvider>
  );
};

export default ProtectedRoutes;
