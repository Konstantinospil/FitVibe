import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";
import AppHeader from "../components/AppHeader";
import { useTranslation } from "react-i18next";

const ACTIVE_APP_PATHS = ["/"] as const;

const MainLayout: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      void navigate("/login", { replace: true });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <a href="#main-content" className="skip-link">
        {t("navigation.skipToContent")}
      </a>
      <AppHeader variant="writing" availablePaths={ACTIVE_APP_PATHS} onSignOut={handleSignOut} />
      <main id="main-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
