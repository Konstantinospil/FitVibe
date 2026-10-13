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
import { readDehydratedStateFromDocument } from "../ssr/dehydratedState";

const ProtectedRoute = lazy(() => import("../components/ProtectedRoute"));
const MainLayout = lazy(() => import("../layouts/MainLayout"));
const Home = lazy(() => import("../pages/Home"));
const Calendar = lazy(() => import("../pages/Calendar"));
const Library = lazy(() => import("../pages/Library"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Settings = lazy(() => import("../pages/Settings"));
const Terms = lazy(() => import("../pages/Terms"));
const Privacy = lazy(() => import("../pages/Privacy"));
const TermsReacceptance = lazy(() => import("../pages/TermsReacceptance"));

const fallback = (
  <div
    className="flex h-screen w-full items-center justify-center text-primary-500"
    role="status"
    aria-live="polite"
  >
    Loading app…
  </div>
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
        await ensurePrivateTranslationsLoaded();
        // The account preference is authoritative after authentication (ADR-031).
        // The browser language remains a fallback if preferences cannot be fetched.
        const preferences = await getUserPreferences();
        if (!active) return;
        await loadLanguageTranslations(preferences.language);
        if (!active) return;
        await i18n.changeLanguage(preferences.language);
      } catch {
        // A preference read failure must not prevent access to protected routes.
      } finally {
        if (active) setTranslationsReady(true);
      }
    })();

    void import("../utils/fontLoader").then(({ loadAppFonts }) => {
      loadAppFonts();
    });

    return () => {
      active = false;
    };
  }, []);

  const dehydratedState = propDehydratedState ?? getDehydratedState();

  const routesContent = (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="library" element={<Library />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms-reacceptance" element={<TermsReacceptance />} />
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
