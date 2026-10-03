import React from "react";

export type LiveRegionPolite = "polite" | "assertive" | "off";

export interface LiveRegionProps {
  children: React.ReactNode;
  level?: LiveRegionPolite;
  id?: string;
}

/**
 * LiveRegion component for announcing dynamic content changes to screen readers.
 * Provides ARIA live region support (WCAG 2.2 AA).
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({ children, level = "polite", id }) => {
  const liveRegionStyle: React.CSSProperties = {
    position: "absolute",
    left: "-10000px",
    width: "1px",
    height: "1px",
    overflow: "hidden",
  };

  return (
    <div id={id} role="status" aria-live={level} aria-atomic="true" style={liveRegionStyle}>
      {children}
    </div>
  );
};
