import React from "react";

export interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * ScreenReaderOnly component for visually hidden but screen reader accessible content.
 * Provides accessible text for screen readers while keeping it visually hidden (WCAG 2.2 AA).
 */
export const ScreenReaderOnly: React.FC<ScreenReaderOnlyProps> = ({
  children,
  as: Component = "span",
}) => {
  const screenReaderOnlyStyle: React.CSSProperties = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  };

  return React.createElement(Component, { style: screenReaderOnlyStyle }, children);
};
