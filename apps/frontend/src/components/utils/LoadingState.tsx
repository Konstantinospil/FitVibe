import React from "react";
import { Spinner } from "../ui/Spinner";

export interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

/**
 * LoadingState component displays a loading indicator with optional message.
 * Can be used as a full-screen overlay or inline.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  size = "md",
  fullScreen = false,
}) => {
  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-md)",
        background: "var(--modal-backdrop)",
        zIndex: 9999,
      }
    : {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-md)",
        padding: "var(--space-xl)",
      };

  return (
    <div style={containerStyle}>
      <Spinner size={size} />
      {message && (
        <p
          style={{
            margin: 0,
            fontSize: "var(--font-size-md)",
            color: fullScreen ? "var(--color-text-primary-on)" : "var(--color-text-secondary)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};
