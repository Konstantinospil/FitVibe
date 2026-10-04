import React, { Component, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { logger } from "../utils/logger.js";

interface Props extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary caught an error", error, {
      componentStack: errorInfo.componentStack,
      context: "errorBoundary",
    });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            background: "var(--surface-danger-subtle)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-danger-subtle)",
          }}
        >
          <strong
            style={{ display: "block", marginBottom: "0.5rem", color: "var(--color-danger)" }}
          >
            {this.props.t("components.errorBoundary.title")}
          </strong>
          <p style={{ margin: 0, fontSize: "var(--type-body-size)" }}>
            {this.state.error?.message || this.props.t("components.errorBoundary.message")}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-glass)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            {this.props.t("components.errorBoundary.tryAgain")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryComponent);
export default ErrorBoundary;
