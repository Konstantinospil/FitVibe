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
const Cookie = lazy(() => import("../pages/Cookie"));
const TermsReacceptance = lazy(() => import("../pages/TermsReacceptance"));
const AdminPasswordUpdate = lazy(() => import("../pages/AdminPasswordUpdate"));

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
    performance.mark("fitvibe:translations:start");

    void (async () => {
      try {
        // Both operations are independent. Start them together, but keep
        // protected content gated until the authoritative language is ready.
        const [translations, preferencesResult] = await Promise.allSettled([
          ensurePrivateTranslationsLoaded(),
          getUserPreferences(),
        ]);
        if (translations.status === "rejected") {
          throw translations.reason;
        }
        if (preferencesResult.status === "rejected") {
          throw preferencesResult.reason;
        }
        performance.mark("fitvibe:translations:initial-settled");
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
        performance.mark("fitvibe:translations:language-ready");
      } catch {
        // A preference read failure must not prevent access to protected routes.
      } finally {
        if (active) {
          performance.mark("fitvibe:translations:gate-open");
          setTranslationsReady(true);
        }
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

  // Keep the security guard inside its own initial-loading boundary. Lazy
  // layouts/pages suspend below it so they cannot discard a settled guard.
  // This is an isolated rendering experiment; all authorization checks remain
  // in ProtectedRoute and must complete before its Outlet is rendered.
  const routesContent = (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route
            path="admin/password-update"
            element={
              <Suspense fallback={fallback}>
                <AdminPasswordUpdate />
              </Suspense>
            }
          />
          <Route
            element={
              <Suspense fallback={fallback}>
                <MainLayout />
              </Suspense>
            }
          >
            <Route index element={<Suspense fallback={fallback}><Home /></Suspense>} />
            <Route path="calendar" element={<Suspense fallback={fallback}><Calendar /></Suspense>} />
            <Route path="library" element={<Suspense fallback={fallback}><Library /></Suspense>} />
            <Route path="dashboard" element={<Suspense fallback={fallback}><Dashboard /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={fallback}><Settings /></Suspense>} />
            <Route path="terms" element={<Suspense fallback={fallback}><Terms /></Suspense>} />
            <Route path="privacy" element={<Suspense fallback={fallback}><Privacy /></Suspense>} />
            <Route path="cookie" element={<Suspense fallback={fallback}><Cookie /></Suspense>} />
            <Route
              path="terms-reacceptance"
              element={<Suspense fallback={fallback}><TermsReacceptance /></Suspense>}
            />
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
