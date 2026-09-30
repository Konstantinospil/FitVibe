import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  showClearButton?: boolean;
}

/**
 * SearchInput component provides a search input with icon and clear button.
 * Optimized for search functionality.
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  onClear,
  showClearButton = true,
}) => {
  const handleClear = () => {
    onChange("");
    onClear?.();
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Search
        size={18}
        style={{
          position: "absolute",
          left: "var(--space-md)",
          color: "var(--color-text-secondary)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          paddingLeft: "calc(var(--space-md) + 18px + var(--space-sm))",
          paddingRight:
            showClearButton && value ? "calc(var(--space-md) + 24px + var(--space-sm))" : undefined,
        }}
        aria-label="Search"
      />
      {showClearButton && value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          leftIcon={<X size={16} />}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: "var(--space-xs)",
            padding: "0.25rem",
            minWidth: "auto",
          }}
        />
      )}
    </div>
  );
};
