import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path: string;
}

const Breadcrumb: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  // Map path segments to translation keys
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const items: BreadcrumbItem[] = [];

    // Always include Home as the first item
    items.push({
      label: t("navigation.home", { defaultValue: "Home" }),
      path: "/",
    });

    // Build breadcrumb items from path segments
    let currentPath = "";
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Map segment to translation key
      let labelKey = "";
      if (segment === "settings") {
        labelKey = "navigation.settings";
      } else if (segment === "profile") {
        labelKey = "navigation.profile";
      } else if (segment === "sessions") {
        labelKey = "navigation.sessions";
      } else if (segment === "planner") {
        labelKey = "sessions.plannerTab";
      } else if (segment === "logger") {
        labelKey = "sessions.loggerTab";
      } else if (segment === "insights") {
        labelKey = "navigation.insights";
      } else if (segment === "admin") {
        labelKey = "admin.dashboard.title";
      } else if (segment === "reports") {
        labelKey = "admin.contentReports.title";
      } else if (segment === "users") {
        labelKey = "admin.userManagement.title";
      } else if (segment === "system") {
        labelKey = "admin.systemControls.title";
      } else if (segment === "translations") {
        labelKey = "admin.dashboard.title"; // Using admin dashboard as fallback, adjust if needed
      } else if (segment === "terms") {
        labelKey = "footer.terms";
      } else if (segment === "privacy") {
        labelKey = "footer.privacy";
      } else if (segment === "cookie") {
        labelKey = "footer.cookie";
      } else if (segment === "impressum") {
        labelKey = "footer.impressum";
      } else if (segment === "contact") {
        labelKey = "footer.contact";
      } else {
        // For dynamic segments like sessionId, use the segment as label
        labelKey = "";
      }

      // Only add items with valid labels (skip dynamic segments unless we have a label)
      if (labelKey || index === pathSegments.length - 1) {
        const label = labelKey ? t(labelKey, { defaultValue: segment }) : segment;
        items.push({
          label,
          path: currentPath,
        });
      }
    });

    return items;
  };

  const items = getBreadcrumbItems();

  return (
    <nav
      aria-label={t("navigation.breadcrumb", { defaultValue: "Breadcrumb" })}
      className="breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-xs)",
        fontSize: "var(--font-size-sm)",
        color: "var(--color-text-secondary)",
        marginTop: "var(--space-xs)",
        flexWrap: "wrap",
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.path}>
            {isLast ? (
              <span
                className="text-primary"
                style={{
                  color: "var(--color-text-primary)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                style={{
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                  transition: "color 150ms ease",
                }}
                className="breadcrumb-link"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--color-accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--color-text-secondary)";
                }}
              >
                {item.label}
              </Link>
            )}
            {!isLast && (
              <ChevronRight
                size={14}
                style={{
                  color: "var(--color-text-muted)",
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
