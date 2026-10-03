import React from "react";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: DividerOrientation;
  label?: string;
}

const baseStyle: React.CSSProperties = {
  border: "none",
  borderColor: "var(--color-border)",
  margin: 0,
};

const horizontalStyle: React.CSSProperties = {
  ...baseStyle,
  width: "100%",
  height: "1px",
  background: "var(--color-border)",
};

const verticalStyle: React.CSSProperties = {
  ...baseStyle,
  width: "1px",
  height: "100%",
  background: "var(--color-border)",
};

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  label,
  className,
  style,
  ...props
}) => {
  if (orientation === "vertical") {
    return (
      <div
        className={className}
        style={{
          ...verticalStyle,
          ...style,
        }}
        role="separator"
        aria-orientation="vertical"
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  }

  if (label) {
    return (
      <div
        className="flex flex--align-center flex--gap-md"
        style={{ width: "100%", margin: "var(--space-lg) 0" }}
      >
        <hr
          className={className}
          style={{
            ...horizontalStyle,
            flex: 1,
            ...style,
          }}
          {...props}
        />
        <span
          className="text-sm"
          style={{
            color: "var(--color-text-muted)",
            padding: "0 var(--space-md)",
          }}
        >
          {label}
        </span>
        <hr
          className={className}
          style={{
            ...horizontalStyle,
            flex: 1,
            ...style,
          }}
          {...props}
        />
      </div>
    );
  }

  return (
    <hr
      className={className}
      style={{
        ...horizontalStyle,
        ...style,
      }}
      role="separator"
      aria-orientation="horizontal"
      {...props}
    />
  );
};
