import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  homeTo?: string;
}

/**
 * Breadcrumbs component for navigation hierarchy.
 * Provides accessible breadcrumb navigation (WCAG 2.2 AA).
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, homeTo = "/" }) => {
  const { t } = useTranslation("common");

  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("navigation.breadcrumbs") || "Breadcrumb"} role="navigation">
      <ol
        className="flex flex--align-center flex--wrap flex--gap-xs"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        <li>
          <Link
            to={homeTo}
            className="flex flex--align-center flex--gap-xs"
            style={{
              color: "var(--color-text-muted)",
              textDecoration: "none",
              fontSize: "var(--font-size-sm)",
            }}
            aria-label={t("navigation.home") || "Home"}
          >
            <Home size={16} />
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex flex--align-center flex--gap-xs">
              <ChevronRight
                size={16}
                style={{ color: "var(--color-text-muted)" }}
                aria-hidden="true"
              />
              {isLast ? (
                <span
                  className="text-sm font-weight-600"
                  style={{ color: "var(--color-text-primary)" }}
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.to ? (
                <Link
                  to={item.to}
                  className="text-sm"
                  style={{
                    color: "var(--color-text-muted)",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-sm text-secondary">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
