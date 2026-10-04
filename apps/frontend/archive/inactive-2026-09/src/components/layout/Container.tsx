import React from "react";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  padding?: boolean;
}

const maxWidthStyles: Record<"sm" | "md" | "lg" | "xl" | "2xl" | "full", React.CSSProperties> = {
  sm: { maxWidth: "640px" },
  md: { maxWidth: "768px" },
  lg: { maxWidth: "1024px" },
  xl: { maxWidth: "1280px" },
  "2xl": { maxWidth: "1536px" },
  full: { maxWidth: "100%" },
};

/**
 * Container component for responsive content wrapping.
 * Provides consistent max-width and padding across the application.
 */
export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = "xl",
  padding = true,
  className,
  style,
  ...props
}) => {
  const containerStyle: React.CSSProperties = {
    width: "100%",
    margin: "0 auto",
    ...maxWidthStyles[maxWidth],
    ...(padding
      ? {
          paddingLeft: "var(--space-lg)",
          paddingRight: "var(--space-lg)",
        }
      : {}),
    ...style,
  };

  return (
    <div className={className} style={containerStyle} {...props}>
      {children}
    </div>
  );
};
