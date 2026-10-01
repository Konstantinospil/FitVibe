import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPanel } from "../../src/components/composites/StatusPanel";

describe("StatusPanel", () => {
  it.each([
    ["loading", "var(--color-info-text)"],
    ["success", "var(--color-success-text)"],
    ["warning", "var(--color-warning-text)"],
    ["error", "var(--color-danger-text)"],
  ] as const)("renders the %s state with its semantic color", (kind, color) => {
    const { container } = render(
      <StatusPanel kind={kind}>
        <span>Status content</span>
      </StatusPanel>,
    );

    const panel = container.querySelector("[data-component='status-panel']");
    const icon = panel?.querySelector("span[aria-hidden='true']") as HTMLElement;
    expect(panel).toHaveAttribute("data-kind", kind);
    expect(icon.getAttribute("style")).toContain(`color: ${color}`);
    if (kind === "loading") {
      expect(icon.querySelector("svg")?.getAttribute("style")).toContain("animation");
    } else {
      expect(icon.querySelector("svg")?.getAttribute("style") ?? "").not.toContain("animation");
    }
  });

  it("renders actions when supplied and omits optional content when absent", () => {
    const { rerender, container } = render(
      <StatusPanel kind="success" actions={<button type="button">Continue</button>} />,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();

    rerender(<StatusPanel kind="success" />);
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-component='form-feedback']")).not.toBeInTheDocument();
  });
});
