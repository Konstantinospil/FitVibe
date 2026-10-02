import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";
import AppHeader from "../components/AppHeader";
import { useTranslation } from "react-i18next";
import { PageShell } from "./PageShell";

const ACTIVE_APP_PATHS = ["/", "/calendar", "/library", "/dashboard", "/settings"] as const;

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
    <>
      <PageShell
        mainId="main-content"
        skipLinkLabel={t("navigation.skipToContent")}
        header={
          <AppHeader
            variant="writing"
            availablePaths={ACTIVE_APP_PATHS}
            onSignOut={handleSignOut}
          />
        }
        footer={<Footer />}
      >
        <Outlet />
      </PageShell>
      <div id="transient-workflow-root" data-transient-workflow-root />
    </>
  );
};

export default MainLayout;
