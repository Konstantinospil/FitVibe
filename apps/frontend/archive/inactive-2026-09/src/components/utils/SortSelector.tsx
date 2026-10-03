import React from "react";
import { ArrowUpDown } from "lucide-react";

export interface SortOption {
  value: string;
  label: string;
}

export interface SortSelectorProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
  label?: string;
}

/**
 * SortSelector component provides a dropdown for selecting sort options.
 * Displays current sort option with icon.
 */
export const SortSelector: React.FC<SortSelectorProps> = ({
  value,
  options,
  onChange,
  label = "Sort by",
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
      }}
    >
      <ArrowUpDown size={18} style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} />
      <label
        style={{
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
          marginRight: "var(--space-xs)",
        }}
      >
        {label}:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "var(--space-xs) var(--space-sm)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-input-bg)",
          color: "var(--color-text-primary)",
          fontSize: "var(--font-size-sm)",
          cursor: "pointer",
        }}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
