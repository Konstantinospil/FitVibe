import React from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input } from "../ui/Input";

export type FeedSortOption = "date" | "popularity" | "relevance";
export type FeedScope = "all" | "following" | "public";

export interface FeedFiltersProps {
  searchQuery?: string;
  sort?: FeedSortOption;
  scope?: FeedScope;
  onSearchChange?: (query: string) => void;
  onSortChange?: (sort: FeedSortOption) => void;
  onScopeChange?: (scope: FeedScope) => void;
  showScopeFilter?: boolean;
}

/**
 * FeedFilters component provides search and sort controls for the feed.
 * Supports search query, sort options, and scope filtering.
 */
export const FeedFilters: React.FC<FeedFiltersProps> = ({
  searchQuery = "",
  sort = "date",
  scope = "all",
  onSearchChange,
  onSortChange,
  onScopeChange,
  showScopeFilter = true,
}) => {
  const { t } = useTranslation("common");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        padding: "var(--space-lg)",
        background: "var(--color-bg-card)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-md)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: "200px",
            position: "relative",
          }}
        >
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "var(--space-md)",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-secondary)",
              pointerEvents: "none",
            }}
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={t("feed.filters.searchPlaceholder")}
            aria-label={t("feed.filters.search")}
            style={{
              paddingLeft: "calc(var(--space-md) + 18px + var(--space-sm))",
            }}
          />
        </div>
        <div style={{ minWidth: "150px" }}>
          <select
            value={sort}
            onChange={(e) => onSortChange?.(e.target.value as FeedSortOption)}
            aria-label={t("feed.filters.sort")}
            style={{
              width: "100%",
              padding: "var(--space-sm) var(--space-md)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-input-bg)",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-md)",
            }}
          >
            <option value="date">{t("feed.filters.sortByDate")}</option>
            <option value="popularity">{t("feed.filters.sortByPopularity")}</option>
            <option value="relevance">{t("feed.filters.sortByRelevance")}</option>
          </select>
        </div>
        {showScopeFilter && (
          <div style={{ minWidth: "150px" }}>
            <select
              value={scope}
              onChange={(e) => onScopeChange?.(e.target.value as FeedScope)}
              aria-label={t("feed.filters.scope")}
              style={{
                width: "100%",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-input-bg)",
                color: "var(--color-text-primary)",
                fontSize: "var(--font-size-md)",
              }}
            >
              <option value="all">{t("feed.filters.scopeAll")}</option>
              <option value="following">{t("feed.filters.scopeFollowing")}</option>
              <option value="public">{t("feed.filters.scopePublic")}</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
