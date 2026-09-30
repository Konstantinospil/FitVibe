import React from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import type { LucideIcon } from "lucide-react";

export interface SidebarItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
  logo?: React.ReactNode;
}

/**
 * Sidebar component - Collapsible sidebar navigation.
 * Provides mobile-friendly navigation with backdrop overlay.
 */
export const Sidebar: React.FC<SidebarProps> = ({ items, isOpen, onClose, logo }) => {
  const { t } = useTranslation();
  const location = useLocation();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-bg)",
          backdropFilter: "blur(4px)",
          zIndex: 999,
        }}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className="flex flex--column"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: "280px",
          maxWidth: "80vw",
          background: "var(--color-bg-card)",
          borderRight: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-e3)",
          zIndex: 1000,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 150ms ease",
        }}
        role="navigation"
        aria-label={t("navigation.sidebar") || "Main navigation"}
      >
        {/* Header */}
        <div
          className="flex flex--align-center flex--justify-between"
          style={{
            padding: "var(--space-lg)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {logo && <div>{logo}</div>}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t("navigation.closeSidebar") || "Close sidebar"}
            leftIcon={<X size={20} />}
          />
        </div>

        {/* Navigation Items */}
        <nav className="flex flex--column" style={{ flex: 1, padding: "var(--space-md)" }}>
          {items.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className="flex flex--align-center flex--gap-md"
                style={{
                  padding: "var(--space-md)",
                  borderRadius: "var(--radius-md)",
                  color: isActive ? "var(--color-primary-on)" : "var(--color-text-primary)",
                  background: isActive ? "var(--color-primary)" : "transparent",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                  marginBottom: "var(--space-xs)",
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <IconComponent size={20} />
                <span className="text-md font-weight-500">{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
