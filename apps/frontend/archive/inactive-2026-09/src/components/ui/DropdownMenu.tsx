import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

export interface DropdownMenuItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  onSelect?: (value: string) => void;
  trigger?: React.ReactElement<
    React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>
  >;
  position?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

/**
 * DropdownMenu component displays a menu of selectable items.
 * Supports icons, dividers, and disabled items.
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  onSelect,
  trigger,
  position = "bottom",
  align = "start",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current || !menuRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const gap = 4;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = triggerRect.top - menuRect.height - gap;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        break;
      case "left":
        top = triggerRect.top;
        left = triggerRect.left - menuRect.width - gap;
        break;
      case "right":
        top = triggerRect.top;
        left = triggerRect.right + gap;
        break;
    }

    switch (align) {
      case "start":
        left = triggerRect.left;
        break;
      case "center":
        left = triggerRect.left + (triggerRect.width - menuRect.width) / 2;
        break;
      case "end":
        left = triggerRect.right - menuRect.width;
        break;
    }

    // Keep menu within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 0) {
      left = gap;
    }
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - gap;
    }
    if (top < 0) {
      top = gap;
    }
    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - gap;
    }

    setMenuStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
    });
  };

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (newIsOpen) {
      setTimeout(updatePosition, 0);
    }
  };

  const handleSelect = (value: string) => {
    setIsOpen(false);
    onSelect?.(value);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      const handleClickOutside = (event: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, {
          ref: triggerRef,
          onClick: handleToggle,
          "aria-expanded": isOpen,
          "aria-haspopup": true,
        })
      ) : (
        <Button
          ref={triggerRef}
          variant="ghost"
          size="md"
          onClick={handleToggle}
          rightIcon={<ChevronDown size={16} />}
          aria-expanded={isOpen}
          aria-haspopup={true}
        >
          Menu
        </Button>
      )}
      {isOpen && (
        <div ref={menuRef}>
          <Card
            style={{
              ...menuStyle,
              minWidth: "160px",
              padding: "var(--space-xs)",
            }}
          >
            {items.map((item, index) => {
              if (item.divider) {
                return (
                  <div
                    key={`divider-${index}`}
                    style={{
                      height: "1px",
                      background: "var(--color-border)",
                      margin: "var(--space-xs) 0",
                    }}
                  />
                );
              }

              return (
                <button
                  key={item.value}
                  onClick={() => !item.disabled && handleSelect(item.value)}
                  disabled={item.disabled}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    padding: "var(--space-sm) var(--space-md)",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-sm)",
                    color: item.disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
                    cursor: item.disabled ? "not-allowed" : "pointer",
                    transition: "background 0.2s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) {
                      e.currentTarget.style.background = "var(--color-bg-secondary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </Card>
        </div>
      )}
    </>
  );
};
