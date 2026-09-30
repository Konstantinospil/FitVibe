import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

export interface PopoverProps {
  trigger: React.ReactElement<React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>>;
  children: React.ReactNode;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  closeOnClickOutside?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Popover component displays content in a floating container.
 * Supports positioning, title, and click-outside-to-close.
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  title,
  position = "bottom",
  closeOnClickOutside = true,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current || !popoverRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.left - popoverRect.width - gap;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }

    // Keep popover within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 0) {
      left = gap;
    }
    if (left + popoverRect.width > viewportWidth) {
      left = viewportWidth - popoverRect.width - gap;
    }
    if (top < 0) {
      top = gap;
    }
    if (top + popoverRect.height > viewportHeight) {
      top = viewportHeight - popoverRect.height - gap;
    }

    setPopoverStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 9999,
    });
  };

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onOpenChange?.(newIsOpen);
    if (newIsOpen) {
      setTimeout(updatePosition, 0);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    onOpenChange?.(false);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      if (closeOnClickOutside) {
        const handleClickOutside = (event: MouseEvent) => {
          if (
            popoverRef.current &&
            !popoverRef.current.contains(event.target as Node) &&
            triggerRef.current &&
            !triggerRef.current.contains(event.target as Node)
          ) {
            handleClose();
          }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          window.removeEventListener("scroll", updatePosition, true);
          window.removeEventListener("resize", updatePosition);
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, closeOnClickOutside]);

  return (
    <>
      {React.cloneElement(trigger, {
        ref: triggerRef,
        onClick: handleToggle,
        "aria-expanded": isOpen,
        "aria-haspopup": true,
      })}
      {isOpen && (
        <div ref={popoverRef}>
          <Card
            style={{
              ...popoverStyle,
              minWidth: "200px",
              maxWidth: "400px",
            }}
          >
            {title && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-md)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--font-size-md)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {title}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  leftIcon={<X size={16} />}
                  aria-label="Close"
                  style={{
                    padding: "0.25rem",
                    minWidth: "auto",
                  }}
                />
              </div>
            )}
            <div style={{ padding: title ? "var(--space-md)" : "var(--space-md)" }}>{children}</div>
          </Card>
        </div>
      )}
    </>
  );
};
