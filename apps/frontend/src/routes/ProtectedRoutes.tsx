import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  QueryClientProvider,
  HydrationBoundary,
  type QueryClient,
  type DehydratedState,
} from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../lib/queryClient";
import { ensurePrivateTranslationsLoaded } from "../i18n/config";

const ProtectedRoute = lazy(() => import("../components/ProtectedRoute"));
const AdminRoute = lazy(() => import("../components/AdminRoute"));
const MainLayout = lazy(() => import("../layouts/MainLayout"));
const Home = lazy(() => import("../pages/Home"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Settings = lazy(() => import("../pages/Settings"));
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const ContentReports = lazy(() => import("../pages/admin/ContentReports"));
const UserManagement = lazy(() => import("../pages/admin/UserManagement"));
const SystemControls = lazy(() => import("../pages/admin/SystemControls"));
const NotFound = lazy(() => import("../pages/NotFound"));
const Terms = lazy(() => import("../pages/Terms"));
const Privacy = lazy(() => import("../pages/Privacy"));
const Cookie = lazy(() => import("../pages/Cookie"));
const Impressum = lazy(() => import("../pages/Impressum"));
const Contact = lazy(() => import("../pages/Contact"));
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

/**
 * Gets the dehydrated state from the window object (injected by SSR)
 * Returns undefined if not available (client-only rendering)
 */
function getDehydratedState(): DehydratedState | undefined {
  if (typeof window !== "undefined") {
    const windowWithState = window as unknown as { __REACT_QUERY_STATE__?: DehydratedState };
    if (windowWithState.__REACT_QUERY_STATE__) {
      const state = windowWithState.__REACT_QUERY_STATE__;
      // Clear it from window to prevent memory leaks
      delete windowWithState.__REACT_QUERY_STATE__;
      return state;
    }
  }
  return undefined;
}

const ProtectedRoutes: React.FC<ProtectedRoutesProps> = ({
  queryClient = defaultQueryClient,
  dehydratedState: propDehydratedState,
}) => {
  const [translationsReady, setTranslationsReady] = useState(false);

  useEffect(() => {
    void Promise.resolve()
      .then(() => ensurePrivateTranslationsLoaded())
      .finally(() => {
        setTranslationsReady(true);
      });
    void import("../utils/fontLoader").then(({ loadAppFonts }) => {
      loadAppFonts();
    });
  }, []);

  // Use prop state if provided (from SSR), otherwise try to get from window
  const dehydratedState = propDehydratedState ?? getDehydratedState();

  const routesContent = (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="cookie" element={<Cookie />} />
            <Route path="impressum" element={<Impressum />} />
            <Route path="contact" element={<Contact />} />
            <Route path="terms-reacceptance" element={<TermsReacceptance />} />
            <Route path="admin" element={<AdminRoute />}>
              <Route index element={<AdminDashboard />} />
              <Route path="reports" element={<ContentReports />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="system" element={<SystemControls />} />
            </Route>
            <Route path="*" element={<NotFound />} />
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
