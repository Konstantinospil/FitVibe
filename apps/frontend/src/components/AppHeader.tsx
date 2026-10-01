import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CalendarDays,
  Home,
  LayoutDashboard,
  Library,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Button, IconButton } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";
import BrandLogo from "./BrandLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { useThemeStore } from "../store/theme.store";
import { AppNavigationItem } from "./composites/AppNavigationItem";
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
          {variant === "writing" ? <span className="app-header__slogan">{brandSlogan}</span> : null}
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

            return (
              <AppNavigationItem
                key={item.to}
                to={item.to}
                label={label}
                icon={<Icon />}
                active={active}
                disabled={!enabled}
                showLabel={variant === "writing"}
              />
            );
          })}
        </nav>

        <div className="app-header__utilities">
          <ThemeToggle variant="header" />
          <LanguageSwitcher variant="header" />
          {variant === "standard" ? (
            <IconButton
              icon={<LogOut aria-hidden="true" />}
              label={signOutLabel}
              variant="ghost"
              size="lg"
              disabled={isSigningOut}
              onClick={() => {
                void handleSignOut();
              }}
              className="app-header__logout"
            />
          ) : (
            <Button
              variant="ghost"
              size="lg"
              isLoading={isSigningOut}
              onClick={() => {
                void handleSignOut();
              }}
              className="app-header__logout"
              leftIcon={<LogOut aria-hidden="true" />}
            >
              {signOutLabel}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
