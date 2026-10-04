import React, { useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
import { useThemeColors } from "../hooks/useThemeColors";
import ThemeToggle from "./ThemeToggle";
import { authApi } from "../services/api";
import logoFull from "../assets/logo_full.png";
import logoFullDark from "../assets/logo_full_dark.png";
import AdminDashboardV2 from "../pages/AdminDashboard_v2";
import AdminStatusHeader from "./AdminStatusHeader";

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const theme = useThemeStore((state) => state.theme);
  const colors = useThemeColors();

  const logo = useMemo(() => {
    return theme === "dark" ? logoFullDark : logoFull;
  }, [theme]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
    signOut();
    void navigate("/login");
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: colors.bg,
        color: colors.text,
      }}
    >
      <aside
        style={{
          width: "250px",
          background: colors.surface,
          padding: "1.5rem",
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}
        >
          <img src={logo} alt="FitVibe Logo" style={{ height: "40px" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: "9rem" }}>
          <AdminDashboardV2 />
        </div>
        <div
          style={{
            position: "fixed",
            left: "1.5rem",
            bottom: "0rem",
            width: "calc(250px - 3rem)",
            paddingTop: "0.5em",
            paddingBottom: "1rem",
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
          }}
        >
          <div
            style={{
              color: colors.textSecondary,
              marginBottom: "1rem",
              fontSize: "var(--type-supporting-size)",
            }}
          >
            Logged in as: {user?.displayName || user?.username}
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <ThemeToggle />
          </div>
          <button
            onClick={() => void handleLogout()}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "2rem", overflow: "auto", background: colors.bg }}>
        <AdminStatusHeader />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
