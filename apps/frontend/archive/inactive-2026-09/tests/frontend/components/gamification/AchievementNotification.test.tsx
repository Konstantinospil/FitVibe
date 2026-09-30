import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AchievementNotification } from "../../src/components/gamification/AchievementNotification";

const badge = {
  id: "badge-1",
  code: "first",
  name: "First Win",
  description: "Nice!",
};

describe("AchievementNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the badge and calls onDismiss after the delay", () => {
    const onDismiss = vi.fn();
    render(<AchievementNotification badge={badge} onDismiss={onDismiss} />);

    expect(screen.getByText("First Win")).toBeInTheDocument();
    expect(screen.getByText("Nice!")).toBeInTheDocument();

    vi.advanceTimersByTime(5000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not auto-dismiss when autoDismiss is false", () => {
    const onDismiss = vi.fn();
    render(<AchievementNotification badge={badge} autoDismiss={false} onDismiss={onDismiss} />);

    expect(screen.getByText("First Win")).toBeInTheDocument();
    vi.advanceTimersByTime(5000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses when the close button is pressed", () => {
    const onDismiss = vi.fn();
    render(<AchievementNotification badge={badge} autoDismiss={false} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
