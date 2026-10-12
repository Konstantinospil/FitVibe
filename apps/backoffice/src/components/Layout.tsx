import React, { useMemo } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useThemeStore } from "../store/theme.store";
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
    <div className="backoffice-shell">
      <aside className="backoffice-sidebar">
        <div className="backoffice-brand">
          <img src={logo} alt="FitVibe Logo" className="backoffice-brand__logo" />
        </div>

        <div className="backoffice-navigation">
          <AdminDashboardV2 />
        </div>

        <div className="backoffice-account">
          <div className="backoffice-account__identity">
            Logged in as: {user?.displayName || user?.username}
          </div>
          <ThemeToggle />
          <button
            onClick={() => void handleLogout()}
            className="backoffice-account__logout"
            type="button"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="backoffice-main">
        <AdminStatusHeader />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
