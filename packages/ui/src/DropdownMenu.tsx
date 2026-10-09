import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
export type DropdownMenuItem = {
  value: string;
  label: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  disabled?: boolean;
};
export interface DropdownMenuProps {
  label: ReactNode;
  items: readonly DropdownMenuItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  showLeadingIcons?: boolean;
  showTrailingIcons?: boolean;
  triggerLeadingIcon?: ReactNode;
  disabled?: boolean;
  defaultOpen?: boolean;
  ariaLabel?: string;
}
const ChevronIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    data-slot="dropdown-chevron"
  >
    <path
      d="m5 7.5 5 5 5-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  label,
  items,
  value,
  onValueChange,
  showLeadingIcons = true,
  showTrailingIcons = true,
  triggerLeadingIcon,
  disabled = false,
  defaultOpen = false,
  ariaLabel,
}) => {
  const menuId = useId(),
    rootRef = useRef<HTMLDivElement>(null),
    itemRefs = useRef<Array<HTMLButtonElement | null>>([]),
    [open, setOpen] = useState(defaultOpen),
    [focusedIndex, setFocusedIndex] = useState(-1);
  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const focusItem = (index: number) => {
    if (index < 0 || index >= items.length || items[index]?.disabled) {
      return;
    }
    setFocusedIndex(index);
    itemRefs.current[index]?.focus();
  };
  const focusFirst = () => {
      const first = enabledIndexes[0];
      if (first !== undefined) {
        focusItem(first);
      }
    },
    focusLast = () => {
      const last = enabledIndexes[enabledIndexes.length - 1];
      if (last !== undefined) {
        focusItem(last);
      }
    };
  const focusRelative = (direction: 1 | -1, fromIndex = focusedIndex) => {
    if (!enabledIndexes.length) {
      return;
    }
    const current = enabledIndexes.indexOf(fromIndex),
      fallback = direction === 1 ? -1 : 0,
      next = (current === -1 ? fallback : current) + direction,
      normalized = (next + enabledIndexes.length) % enabledIndexes.length;
    focusItem(enabledIndexes[normalized]);
  };
  const closeAndReturnFocus = () => {
    setOpen(false);
    setFocusedIndex(-1);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-slot='dropdown-trigger']")?.focus();
  };
  const choose = (item: DropdownMenuItem) => {
    if (item.disabled) {
      return;
    }
    onValueChange?.(item.value);
    closeAndReturnFocus();
  };
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const icons =
    showLeadingIcons && showTrailingIcons
      ? "both"
      : showLeadingIcons
        ? "leading"
        : showTrailingIcons
          ? "trailing"
          : "none";
  return (
    <div
      ref={rootRef}
      data-component="dropdown-menu"
      data-state={disabled ? "disabled" : open ? "open" : "closed"}
    >
      <Button
        data-slot="dropdown-trigger"
        type="button"
        variant="ghost"
        size="lg"
        fullWidth
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            window.setTimeout(focusFirst, 0);
          } else {
            setFocusedIndex(-1);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              window.setTimeout(e.key === "ArrowDown" ? focusFirst : focusLast, 0);
            } else if (e.key === "ArrowDown") {
              focusRelative(1);
            } else {
              focusRelative(-1);
            }
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            closeAndReturnFocus();
          }
        }}
      >
        <span data-slot="dropdown-trigger-copy">
          {triggerLeadingIcon ? (
            <span aria-hidden="true" data-slot="dropdown-trigger-leading-icon">
              {triggerLeadingIcon}
            </span>
          ) : null}
          <span data-slot="dropdown-trigger-label">{label}</span>
        </span>
        <ChevronIcon />
      </Button>
      {open ? (
        <div id={menuId} role="menu" aria-label={ariaLabel} data-slot="dropdown-list">
          {items.map((item, index) => {
            const selected = item.value === value,
              highlighted = focusedIndex === index;
            return (
              <Button
                key={item.value}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                variant="ghost"
                size="lg"
                fullWidth
                role="menuitemradio"
                aria-checked={selected}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                tabIndex={highlighted ? 0 : -1}
                data-slot="dropdown-item"
                data-selected={selected ? "true" : "false"}
                data-highlighted={highlighted ? "true" : "false"}
                onClick={() => choose(item)}
                onFocus={() => setFocusedIndex(index)}
                onMouseEnter={() => {
                  if (!item.disabled) {
                    setFocusedIndex(index);
                  }
                }}
                onKeyDown={(e) => {
                  switch (e.key) {
                    case "ArrowDown":
                      e.preventDefault();
                      focusRelative(1, index);
                      break;
                    case "ArrowUp":
                      e.preventDefault();
                      focusRelative(-1, index);
                      break;
                    case "Home":
                      e.preventDefault();
                      focusFirst();
                      break;
                    case "End":
                      e.preventDefault();
                      focusLast();
                      break;
                    case "Escape":
                      e.preventDefault();
                      closeAndReturnFocus();
                      break;
                    case "Enter":
                    case " ":
                      e.preventDefault();
                      choose(item);
                      break;
                    default:
                      break;
                  }
                }}
              >
                <span data-slot="dropdown-item-content" data-icons={icons}>
                  {showLeadingIcons ? (
                    <span aria-hidden="true" data-slot="dropdown-leading-icon">
                      {item.leadingIcon ?? null}
                    </span>
                  ) : null}
                  <span data-slot="dropdown-label">{item.label}</span>
                  {showTrailingIcons ? (
                    <span aria-hidden="true" data-slot="dropdown-trailing-icon">
                      {item.trailingIcon ?? null}
                    </span>
                  ) : null}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
DropdownMenu.displayName = "DropdownMenu";
