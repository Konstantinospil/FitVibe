import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export interface AccordionProps {
  children: React.ReactNode;
  allowMultiple?: boolean;
}

/**
 * AccordionItem component for collapsible content sections.
 */
export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  defaultOpen = false,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    defaultOpen ? undefined : 0,
  );

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen, children]);

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onToggle?.(newIsOpen);
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-md)",
          background: "var(--color-bg-card)",
          border: "none",
          cursor: "pointer",
          fontSize: "var(--font-size-md)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-bg-secondary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--color-bg-card)";
        }}
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${title}`}
      >
        <span>{title}</span>
        <ChevronDown
          size={20}
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            color: "var(--color-text-secondary)",
          }}
        />
      </button>
      <div
        id={`accordion-content-${title}`}
        style={{
          maxHeight: contentHeight !== undefined ? `${contentHeight}px` : "none",
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <div
          ref={contentRef}
          style={{
            padding: "var(--space-md)",
            background: "var(--color-bg-primary)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Accordion component groups multiple AccordionItems.
 */
export const Accordion: React.FC<AccordionProps> = ({
  children,
  allowMultiple: _allowMultiple = false,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
      }}
    >
      {children}
    </div>
  );
};
