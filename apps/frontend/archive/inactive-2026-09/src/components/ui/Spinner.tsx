import React from "react";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, React.CSSProperties> = {
  sm: {
    width: "1rem",
    height: "1rem",
    borderWidth: "2px",
  },
  md: {
    width: "1.5rem",
    height: "1.5rem",
    borderWidth: "3px",
  },
  lg: {
    width: "2rem",
    height: "2rem",
    borderWidth: "4px",
  },
};

const baseStyle: React.CSSProperties = {
  display: "inline-block",
  borderRadius: "50%",
  borderStyle: "solid",
  borderColor: "rgba(255, 255, 255, 0.2)",
  borderTopColor: "var(--color-text-primary)",
  animation: "spinner-rotate 0.6s linear infinite",
};

// Add keyframes if not already in global.css
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spinner-rotate {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      [data-spinner-keyframes-target] {
        animation: none;
      }
    }
  `;
  if (!document.head.querySelector("style[data-spinner-keyframes]")) {
    style.setAttribute("data-spinner-keyframes", "true");
    document.head.appendChild(style);
  }
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  label,
  className,
  style,
  ...props
}) => {
  const computedStyle: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...style,
  };

  return (
    <div
      className={className}
      style={computedStyle}
      role="status"
      aria-label={label || "Loading"}
      aria-live="polite"
      data-spinner-keyframes-target=""
      {...props}
    >
      {label && (
        <span
          className="sr-only"
          style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden" }}
        >
          {label}
        </span>
      )}
    </div>
  );
};
