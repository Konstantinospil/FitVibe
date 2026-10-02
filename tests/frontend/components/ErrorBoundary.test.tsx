import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  withTranslation:
    () =>
    (Component: React.ComponentType<any>) =>
    (props: Record<string, unknown>) => (
      <Component
        {...props}
        t={(key: string) => key}
        i18n={{}}
        tReady={true}
      />
    ),
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import ErrorBoundary from "../../src/components/ErrorBoundary";
import { logger } from "../../src/utils/logger.js";

const Broken: React.FC<{ message?: string }> = ({ message = "Boom" }) => {
  throw new Error(message);
};

describe("ErrorBoundary", () => {
  it("renders children while no descendant has failed", () => {
    render(
      <ErrorBoundary>
        <div>Healthy child</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Healthy child")).toBeInTheDocument();
  });

  it("reports descendant errors and renders the default recovery UI", () => {
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary onError={onError}>
        <Broken message="Workout card failed" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("components.errorBoundary.title")).toBeInTheDocument();
    expect(screen.getByText("Workout card failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "components.errorBoundary.tryAgain" })).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "ErrorBoundary caught an error",
      expect.any(Error),
      expect.objectContaining({ context: "errorBoundary" }),
    );
  });

  it("renders a caller-provided fallback instead of the default recovery UI", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary fallback={<div>Feature temporarily unavailable</div>}>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Feature temporarily unavailable")).toBeInTheDocument();
    expect(screen.queryByText("components.errorBoundary.title")).not.toBeInTheDocument();
  });

  it("uses translated fallback copy when an error has no message", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <Broken message="" />
      </ErrorBoundary>,
    );

    expect(screen.getByText("components.errorBoundary.message")).toBeInTheDocument();
  });

  it("can retry rendering after the failing condition is cleared", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;

    const Recoverable: React.FC = () => {
      if (shouldThrow) {
        throw new Error("Temporary failure");
      }
      return <div>Recovered child</div>;
    };

    render(
      <ErrorBoundary>
        <Recoverable />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Temporary failure")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "components.errorBoundary.tryAgain" }));

    expect(screen.getByText("Recovered child")).toBeInTheDocument();
    expect(screen.queryByText("Temporary failure")).not.toBeInTheDocument();
  });
});
