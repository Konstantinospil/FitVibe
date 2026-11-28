import type React from "react";
import { StaticRouter } from "react-router";
import {
  QueryClientProvider,
  HydrationBoundary,
  type QueryClient,
  type DehydratedState,
} from "@tanstack/react-query";
import ProtectedRoutes from "./ProtectedRoutes";

export interface ServerRouterProps {
  location: string;
  queryClient: QueryClient;
  dehydratedState?: DehydratedState;
}

/**
 * SSR Router component for server-side rendering
 * Uses StaticRouter for deterministic server rendering
 */
export const ServerRouter: React.FC<ServerRouterProps> = ({
  location,
  queryClient,
  dehydratedState,
}) => {
  return (
    <StaticRouter location={location}>
      <QueryClientProvider client={queryClient}>
        {dehydratedState ? (
          <HydrationBoundary state={dehydratedState}>
            <ProtectedRoutes />
          </HydrationBoundary>
        ) : (
          <ProtectedRoutes />
        )}
      </QueryClientProvider>
    </StaticRouter>
  );
};
