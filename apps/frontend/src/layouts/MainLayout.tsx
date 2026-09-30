import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Avatar, Button } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";
import Footer from "../components/Footer";
import { useTranslation } from "react-i18next";
import { LogOut, Home, type LucideIcon } from "lucide-react";
import logoFull from "../assets/logo_full.ico";

type NavItem = {
  to: string;
  labelKey: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [{ to: "/", labelKey: "navigation.home", icon: Home }];

const MainLayout: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    void navigate("/login", { replace: true });
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
      <header
        style={{
          backdropFilter: "blur(14px)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <nav
          aria-label={t("navigation.home")}
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "1.15rem clamp(1rem, 5vw, 2.5rem)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              fontWeight: 600,
              letterSpacing: "var(--letter-spacing-wide)",
              textTransform: "uppercase",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <img
              src={logoFull}
              alt="FitVibe Logo"
              fetchPriority="high"
              loading="eager"
              width="36"
              height="36"
              style={{
                height: "36px",
                width: "auto",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {NAV_ITEMS.map((item) => {
              const IconComponent = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    color: isActive ? "#0f172a" : "var(--color-text-secondary)",
                    background: isActive ? "var(--color-accent)" : "transparent",
                    transition: "all 150ms ease",
                    border: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                  })}
                  end={item.to === "/"}
                  title={t(item.labelKey)}
                  aria-label={t(item.labelKey)}
                >
                  <IconComponent size={20} strokeWidth={2} />
                </NavLink>
              );
            })}
            <ThemeToggle />
            <LanguageSwitcher />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                marginLeft: "0.8rem",
              }}
            >
              <Avatar name={t("navigation.you") || "You"} size={40} status="online" />
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600 }}>
                  {t("navigation.you")}
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {t("navigation.activeSession")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void handleSignOut().catch(() => {
                    // Sign out failed, navigate anyway
                    void navigate("/login", { replace: true });
                  });
                }}
                aria-label={t("navigation.signOut")}
                title={t("navigation.signOut")}
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </nav>
      </header>
      <main id="main-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
