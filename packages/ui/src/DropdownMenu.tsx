import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 150ms ease",
    }}
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
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0);

  const focusItem = (index: number) => {
    if (index < 0 || index >= items.length || items[index]?.disabled) return;
    setFocusedIndex(index);
    itemRefs.current[index]?.focus();
  };

  const focusFirst = () => {
    const first = enabledIndexes[0];
    if (first !== undefined) focusItem(first);
  };

  const focusLast = () => {
    const last = enabledIndexes[enabledIndexes.length - 1];
    if (last !== undefined) focusItem(last);
  };

  const focusRelative = (direction: 1 | -1, fromIndex = focusedIndex) => {
    if (enabledIndexes.length === 0) {
      return;
    }
    const currentPosition = enabledIndexes.indexOf(fromIndex);
    const fallback = direction === 1 ? -1 : 0;
    const nextPosition = (currentPosition === -1 ? fallback : currentPosition) + direction;
    const normalized = (nextPosition + enabledIndexes.length) % enabledIndexes.length;
    focusItem(enabledIndexes[normalized]);
  };

  const closeAndReturnFocus = () => {
    setOpen(false);
    setFocusedIndex(-1);
    rootRef.current
      ?.querySelector<HTMLButtonElement>("[data-slot='dropdown-trigger']")
      ?.focus();
  };

  const choose = (item: DropdownMenuItem) => {
    if (item.disabled) return;
    onValueChange?.(item.value);
    closeAndReturnFocus();
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-component="dropdown-menu"
      data-state={disabled ? "disabled" : open ? "open" : "closed"}
      style={{
        position: "relative",
        width: "100%",
        opacity: disabled ? "var(--opacity-disabled)" : "var(--opacity-full)",
      }}
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
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            window.setTimeout(focusFirst, 0);
          } else {
            setFocusedIndex(-1);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              window.setTimeout(
                event.key === "ArrowDown" ? focusFirst : focusLast,
                0,
              );
            } else {
              event.key === "ArrowDown" ? focusRelative(1) : focusRelative(-1);
            }
          }
          if (event.key === "Escape" && open) {
            event.preventDefault();
            closeAndReturnFocus();
          }
        }}
        style={{
          minHeight: "56px",
          justifyContent: "space-between",
          padding: "var(--space-sm) var(--space-lg)",
          border: "1px solid var(--color-border)",
          borderRadius: open
            ? "var(--radius-lg) var(--radius-lg) 0 0"
            : "var(--radius-lg)",
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          boxShadow: open ? "var(--shadow-e2)" : "var(--shadow-e1)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            minWidth: 0,
          }}
        >
          {triggerLeadingIcon ? (
            <span
              aria-hidden="true"
              data-slot="dropdown-trigger-leading-icon"
              style={{
                width: "24px",
                height: "24px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {triggerLeadingIcon}
            </span>
          ) : null}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </span>
        <ChevronIcon open={open} />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          data-slot="dropdown-list"
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "100%",
            left: 0,
            right: 0,
            overflow: "hidden",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
            boxShadow: "var(--shadow-e2)",
          }}
        >
          {items.map((item, index) => {
            const selected = item.value === value;
            const highlighted = focusedIndex === index;

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
                onClick={() => choose(item)}
                onFocus={() => setFocusedIndex(index)}
                onMouseEnter={() => {
                  if (!item.disabled) setFocusedIndex(index);
                }}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case "ArrowDown":
                      event.preventDefault();
                      focusRelative(1, index);
                      break;
                    case "ArrowUp":
                      event.preventDefault();
                      focusRelative(-1, index);
                      break;
                    case "Home":
                      event.preventDefault();
                      focusFirst();
                      break;
                    case "End":
                      event.preventDefault();
                      focusLast();
                      break;
                    case "Escape":
                      event.preventDefault();
                      closeAndReturnFocus();
                      break;
                    case "Enter":
                    case " ":
                      event.preventDefault();
                      choose(item);
                      break;
                    default:
                      break;
                  }
                }}
                style={{
                  minHeight: "52px",
                  justifyContent: "flex-start",
                  padding: "var(--space-sm) var(--space-lg)",
                  borderRadius: "var(--radius-none)",
                  borderBottom:
                    index === items.length - 1
                      ? "none"
                      : "1px solid var(--color-border)",
                  background:
                    selected || highlighted
                      ? "var(--color-surface-muted)"
                      : "var(--color-surface)",
                  color: selected
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  fontWeight: selected
                    ? "var(--font-weight-semibold)"
                    : "var(--font-weight-regular)",
                  boxShadow: "none",
                }}
              >
                <span
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns:
                      showLeadingIcons && showTrailingIcons
                        ? "24px minmax(0, 1fr) 24px"
                        : showLeadingIcons
                          ? "24px minmax(0, 1fr)"
                          : showTrailingIcons
                            ? "minmax(0, 1fr) 24px"
                            : "minmax(0, 1fr)",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                  }}
                >
                  {showLeadingIcons ? (
                    <span
                      aria-hidden="true"
                      data-slot="dropdown-leading-icon"
                      style={{
                        width: "24px",
                        height: "24px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.leadingIcon ?? null}
                    </span>
                  ) : null}

                  <span
                    data-slot="dropdown-label"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                    }}
                  >
                    {item.label}
                  </span>

                  {showTrailingIcons ? (
                    <span
                      aria-hidden="true"
                      data-slot="dropdown-trailing-icon"
                      style={{
                        width: "24px",
                        height: "24px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
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
