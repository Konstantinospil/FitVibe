import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tooltip } from "../../src/components/ui/Tooltip";

describe("Tooltip", () => {
  it("shows and hides tooltip content on hover", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful text" delay={50}>
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.mouseEnter(trigger);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful text");

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
