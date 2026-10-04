import React from "react";
import { Filter, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

export interface FilterItem {
  key: string;
  label: string;
  value: string;
}

export interface FilterBarProps {
  filters: FilterItem[];
  onRemoveFilter: (key: string) => void;
  onClearAll?: () => void;
  showClearAll?: boolean;
}

/**
 * FilterBar component displays active filters as removable badges.
 * Supports removing individual filters or clearing all.
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
  showClearAll = true,
}) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        flexWrap: "wrap",
        padding: "var(--space-md)",
        background: "var(--color-bg-secondary)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
      }}
    >
      <Filter size={18} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          marginRight: "var(--space-xs)",
        }}
      >
        Filters:
      </span>
      {filters.map((filter) => (
        <Badge
          key={filter.key}
          variant="info"
          size="sm"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-xs)",
            paddingRight: "var(--space-xs)",
          }}
        >
          <span>
            {filter.label}: {filter.value}
          </span>
          <button
            onClick={() => onRemoveFilter(filter.key)}
            aria-label={`Remove filter ${filter.label}`}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0",
              display: "flex",
              alignItems: "center",
              color: "inherit",
            }}
          >
            <X size={12} />
          </button>
        </Badge>
      ))}
      {showClearAll && filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          style={{
            marginLeft: "auto",
            fontSize: "var(--font-size-sm)",
          }}
        >
          Clear all
        </Button>
      )}
    </div>
  );
};
