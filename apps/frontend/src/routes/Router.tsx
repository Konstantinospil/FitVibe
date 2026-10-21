/**
 * Router component that works for both SSR (StaticRouter) and client (BrowserRouter)
 * This component is used by both server and client entry points
 */

import React, { Suspense, lazy } from "react";
import { BrowserRouter, StaticRouter } from "react-router-dom";
import type { QueryClient, DehydratedState } from "@tanstack/react-query";
import * as AuthContext from "../contexts/AuthContext.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import PublicRoutes from "./PublicRoutes.js";
import CookieConsent from "../components/CookieConsent";
const ProtectedRoutes = lazy(() => import("./ProtectedRoutes.js"));

const loadingFallback = (
  <div
    className="flex h-screen w-full items-center justify-center text-primary-500"
    data-ssr-loading-fallback="true"
    role="status"
    aria-live="polite"
  >
    Loading...
  </div>
);

type AuthHook = () => { isAuthenticated: boolean };

const useAuthOrFallback: AuthHook =
  typeof (AuthContext as { useAuth?: AuthHook }).useAuth === "function"
    ? (AuthContext as { useAuth: AuthHook }).useAuth
    : () => ({ isAuthenticated: false });

type RouterContentProps = {
  queryClient?: QueryClient;
  dehydratedState?: DehydratedState;
};

const RouterContent: React.FC<RouterContentProps> = ({ queryClient, dehydratedState }) => {
  const { isAuthenticated } = useAuthOrFallback();
  return isAuthenticated ? (
    <ProtectedRoutes queryClient={queryClient} dehydratedState={dehydratedState} />
  ) : (
    <PublicRoutes />
  );
};

type RouterProps = {
  location?: string;
  basename?: string;
  queryClient?: QueryClient;
  dehydratedState?: DehydratedState;
};

/**
 * Router component that works for both SSR and client-side rendering
 * - On server: uses StaticRouter with location prop
 * - On client: uses BrowserRouter
 */
export const Router: React.FC<RouterProps> = ({
  location,
  basename,
  queryClient,
  dehydratedState,
}) => {
  const routerContent = (
    <ErrorBoundary>
      <AuthContext.AuthProvider>
        <Suspense fallback={loadingFallback}>
          <RouterContent queryClient={queryClient} dehydratedState={dehydratedState} />
        </Suspense>
        <CookieConsent />
      </AuthContext.AuthProvider>
    </ErrorBoundary>
  );

  // Server-side rendering: use StaticRouter
  if (typeof window === "undefined" && location !== undefined) {
    return (
      <StaticRouter location={location} basename={basename}>
        {routerContent}
      </StaticRouter>
    );
  }

  // Client-side rendering: use BrowserRouter
  return <BrowserRouter basename={basename}>{routerContent}</BrowserRouter>;
};

export default Router;
