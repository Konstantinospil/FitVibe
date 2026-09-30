import React from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface HeaderProps {
  logo?: React.ReactNode;
  navItems?: NavItem[];
  rightContent?: React.ReactNode;
}

/**
 * Header component for main navigation with vibe accents.
 * Provides consistent header styling and navigation structure.
 */
export const Header: React.FC<HeaderProps> = ({ logo, navItems = [], rightContent }) => {
  const { t } = useTranslation();

  const headerStyle: React.CSSProperties = {
    backdropFilter: "blur(14px)",
    background: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  };

  const navStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "1.15rem clamp(1rem, 5vw, 2.5rem)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "2rem",
  };

  const logoStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontWeight: 600,
    letterSpacing: "var(--letter-spacing-wide)",
    textTransform: "uppercase",
    fontSize: "var(--font-size-sm)",
  };

  const navItemsStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  };

  return (
    <header style={headerStyle}>
      <nav aria-label={t("navigation.main") || "Main navigation"} style={navStyle}>
        {logo && <div style={logoStyle}>{logo}</div>}
        {navItems.length > 0 && (
          <div style={navItemsStyle}>
            {navItems.map((item) => {
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
                  aria-label={t(item.labelKey)}
                >
                  <IconComponent size={20} />
                </NavLink>
              );
            })}
          </div>
        )}
        {rightContent && <div>{rightContent}</div>}
      </nav>
    </header>
  );
};
