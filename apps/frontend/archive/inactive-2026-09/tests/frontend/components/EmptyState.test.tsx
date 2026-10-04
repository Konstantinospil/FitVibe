import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "../../src/components/utils/EmptyState";

describe("EmptyState", () => {
  it("renders title, message, and action", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No results"
        message="Try a different filter."
        action={{ label: "Retry", onClick }}
      />,
    );

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Try a different filter.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
