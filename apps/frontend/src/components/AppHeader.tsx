import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  Home,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { useThemeStore } from "../store/theme.store";
import "./AppHeader.css";

export type AppHeaderVariant = "standard" | "writing";

type HeaderNavItem = {
  to: string;
  labelKey: string;
  fallbackLabel: string;
  icon: LucideIcon;
};

export type AppHeaderProps = {
  variant?: AppHeaderVariant;
  slogan?: string;
  availablePaths?: readonly string[];
  onSignOut: () => void | Promise<void>;
};

const DEFAULT_AVAILABLE_PATHS = ["/"] as const;

const NAV_ITEMS: readonly HeaderNavItem[] = [
  { to: "/", labelKey: "navigation.home", fallbackLabel: "Home", icon: Home },
  {
    to: "/calendar",
    labelKey: "navigation.calendar",
    fallbackLabel: "Calendar",
    icon: CalendarDays,
  },
  {
    to: "/library",
    labelKey: "navigation.library",
    fallbackLabel: "Library",
    icon: Library,
  },
  {
    to: "/dashboard",
    labelKey: "navigation.dashboard",
    fallbackLabel: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/settings",
    labelKey: "navigation.settings",
    fallbackLabel: "Settings",
    icon: Settings,
  },
];

const isActivePath = (pathname: string, target: string) =>
  target === "/" ? pathname === "/" : pathname === target || pathname.startsWith(`${target}/`);

const AppHeader: React.FC<AppHeaderProps> = ({
  variant = "writing",
  slogan,
  availablePaths = DEFAULT_AVAILABLE_PATHS,
  onSignOut,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const theme = useThemeStore((state) => state.theme);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [logoutHovered, setLogoutHovered] = useState(false);

  const enabledPaths = useMemo(() => new Set(availablePaths), [availablePaths]);

  const translateLabel = (key: string, fallback: string) => {
    const translated = String(t(key));
    return translated === key ? fallback : translated;
  };

  const translatedSlogan = String(t("brand.slogan"));
  const brandSlogan =
    slogan ?? (translatedSlogan === "brand.slogan" ? "Balance is not a state" : translatedSlogan);
  const signOutLabel = translateLabel("navigation.signOut", "Logout");

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header
      className={`app-header app-header--${variant}`}
      data-component="app-header"
      data-variant={variant}
      data-theme={theme}
    >
      <div className="app-header__inner">
        <div className="app-header__brand">
          <BrandLogo size="sm" priority />
          {variant === "writing" ? (
            <span className="app-header__slogan">{brandSlogan}</span>
          ) : null}
        </div>

        <nav
          className="app-header__navigation"
          aria-label={translateLabel("navigation.home", "Main navigation")}
        >
          {NAV_ITEMS.map((item) => {
            const label = translateLabel(item.labelKey, item.fallbackLabel);
            const Icon = item.icon;
            const enabled = enabledPaths.has(item.to);
            const active = enabled && isActivePath(location.pathname, item.to);

            const content = (
              <>
                <Icon className="app-header__nav-icon" aria-hidden="true" />
                {variant === "writing" ? (
                  <span className="app-header__nav-label">{label}</span>
                ) : null}
              </>
            );

            if (!enabled) {
              return (
                <span
                  key={item.to}
                  className="app-header__nav-item"
                  role="link"
                  aria-label={label}
                  aria-disabled="true"
                  data-state="disabled"
                  title={label}
                >
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className="app-header__nav-item"
                aria-label={label}
                aria-current={active ? "page" : undefined}
                data-state={active ? "active" : "default"}
                title={label}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="app-header__utilities">
          <ThemeToggle variant="header" />
          <LanguageSwitcher variant="header" />
          <Button
            variant="ghost"
            size="sm"
            isLoading={isSigningOut}
            onClick={() => {
              void handleSignOut();
            }}
            onMouseEnter={() => setLogoutHovered(true)}
            onMouseLeave={() => setLogoutHovered(false)}
            className="app-header__logout"
            aria-label={signOutLabel}
            title={signOutLabel}
            style={{
              minHeight: "44px",
              minWidth: variant === "standard" ? "44px" : "auto",
              padding:
                variant === "standard" ? "var(--space-xs)" : "var(--space-xs) var(--space-sm)",
              borderRadius: "var(--radius-md)",
              background: logoutHovered ? "var(--color-surface-muted)" : "none",
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-family-body)",
              fontWeight: "var(--font-weight-semibold)",
              fontSize: "var(--type-control-size)",
              lineHeight: "var(--type-control-line-height)",
              letterSpacing: "var(--type-control-letter-spacing)",
            }}
          >
            <LogOut className="app-header__logout-icon" aria-hidden="true" />
            {variant === "writing" ? (
              <span className="app-header__logout-label">{signOutLabel}</span>
            ) : null}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
