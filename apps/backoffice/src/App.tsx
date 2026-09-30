import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Login from "./pages/Login";
import TranslationsPage from "./pages/Translations";
import LegalPublicationsPage from "./pages/LegalPublications";
import MessagesPage from "./pages/Messages";
import AuditLogsPage from "./pages/AuditLogs";
import SettingsPage from "./pages/Settings";
import UsersPage from "./pages/Users";
import ContentReportsV2 from "./pages/ContentReports_v2";
import PrivilegeManagementPage from "./pages/PrivilegeManagement";
import Layout from "./components/Layout";
import { useAuthStore } from "./store/auth.store";
import { useThemeStore } from "./store/theme.store";
import { apiClient, authApi } from "./services/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode; isInitializing: boolean }> = ({
  children,
  isInitializing,
}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Show loading state while initializing to prevent premature redirects
  if (isInitializing) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!["admin", "superadmin"].includes(user.role ?? "")) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const signIn = useAuthStore((state) => state.signIn);
  const theme = useThemeStore((state) => state.theme);
  const [isInitializing, setIsInitializing] = useState(true);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Restore authentication state on page load
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        // Pre-fetch CSRF token first (with timeout)
        try {
          await Promise.race([
            apiClient.get("/api/v1/csrf-token"),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
          ]);
        } catch (error) {
          // Ignore CSRF token errors - not critical for initial load
          console.warn("Failed to fetch CSRF token, continuing:", error);
        }

        if (cancelled) {
          return;
        }

        // Check if there's a valid session by calling /api/v1/users/me
        try {
          const response = await authApi.me();
          if (cancelled) {
            return;
          }

          const user = response.user;
          if (user && ["admin", "superadmin"].includes(user.role)) {
            // Session is valid, restore auth state
            signIn({
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              email: user.email,
              role: user.role,
            });
          }
        } catch {
          // Session is invalid or expired - user needs to log in
          // This is expected for users who haven't logged in yet
          if (!cancelled) {
            console.warn("No valid session found, user needs to log in");
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error restoring session:", error);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [signIn]);

  const colors =
    theme === "light"
      ? { bg: "var(--color-on-color)", text: "var(--color-text-primary)" }
      : { bg: "var(--color-text-primary)", text: "var(--color-on-color)" };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute isInitializing={isInitializing}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/translations" replace />} />
              <Route path="translations" element={<TranslationsPage />} />
              <Route path="legal-publications" element={<LegalPublicationsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="admin/reports" element={<ContentReportsV2 />} />
              <Route path="superadmin/privileges" element={<PrivilegeManagementPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </div>
  );
};

export default App;
