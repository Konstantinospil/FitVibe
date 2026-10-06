import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RetryErrorPanel, StatusPanel } from "../../src/components/composites/StatusPanel";

describe("StatusPanel", () => {
  it.each(["loading", "success", "warning", "error"] as const)(
    "exposes the %s semantic state",
    (kind) => {
      const { container } = render(
        <StatusPanel kind={kind}>
          <span>Status content</span>
        </StatusPanel>,
      );
      const panel = container.querySelector("[data-component='status-panel']");
      expect(panel).toHaveAttribute("data-kind", kind);
      expect(panel?.querySelector("[data-slot='status-icon']")).toBeInTheDocument();
      expect(panel?.querySelector("[data-component='form-feedback']")).toBeInTheDocument();
    },
  );

  it("renders actions when supplied and omits optional content when absent", () => {
    const { rerender, container } = render(
      <StatusPanel kind="success" actions={<button type="button">Continue</button>} />,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    rerender(<StatusPanel kind="success" />);
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-component='form-feedback']")).not.toBeInTheDocument();
  });

  it("exposes retry behavior through the active composite", () => {
    const onRetry = vi.fn();
    render(
      <RetryErrorPanel message="Could not load data" retryLabel="Retry" onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Could not load data")).toBeInTheDocument();
  });
});
