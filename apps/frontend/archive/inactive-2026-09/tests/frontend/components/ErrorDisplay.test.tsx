import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorDisplay } from "../../src/components/utils/ErrorDisplay";

describe("ErrorDisplay", () => {
  it("renders default title and message", () => {
    render(<ErrorDisplay message="Something went wrong" />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    render(
      <ErrorDisplay title="Oops" message="Try again later" onRetry={onRetry} retryLabel="Retry" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render retry button when onRetry is missing", () => {
    render(<ErrorDisplay message="Missing data" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the compact variant with a retry action", () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay variant="compact" message="Network down" onRetry={onRetry} />);

    expect(screen.getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the compact variant without retry", () => {
    render(<ErrorDisplay variant="compact" message="Offline" />);
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
