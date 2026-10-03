import React, { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../lib/queryClient";
import { ensurePrivateTranslationsLoaded } from "../i18n/config";
import { readDehydratedStateFromDocument } from "../ssr/dehydratedState";

const ProtectedRoute = lazy(() => import("../components/ProtectedRoute"));
const MainLayout = lazy(() => import("../layouts/MainLayout"));
const Home = lazy(() => import("../pages/Home"));
const Calendar = lazy(() => import("../pages/Calendar"));
const AppSurfacePlaceholder = lazy(() => import("../pages/AppSurfacePlaceholder"));
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
    void Promise.resolve()
      .then(() => ensurePrivateTranslationsLoaded())
      .finally(() => {
        setTranslationsReady(true);
      });
    void import("../utils/fontLoader").then(({ loadAppFonts }) => {
      loadAppFonts();
    });
  }, []);

  const dehydratedState = propDehydratedState ?? getDehydratedState();

  const routesContent = (
    <Suspense fallback={fallback}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="library" element={<AppSurfacePlaceholder title="Library" />} />
            <Route path="dashboard" element={<AppSurfacePlaceholder title="Dashboard" />} />
            <Route path="settings" element={<AppSurfacePlaceholder title="Settings" />} />
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
