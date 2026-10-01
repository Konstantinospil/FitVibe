import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VibeBadge } from "../../src/components/domain/VibeBadge";

describe("VibeBadge", () => {
  it("uses default and hover as the only visual states", () => {
    render(<VibeBadge vibe="strength" label="Strength" level="12.4" />);
    const badge = screen.getByRole("button", { name: "Strength. Show level" });

    expect(badge).toHaveAttribute("data-state", "default");
    fireEvent.mouseEnter(badge);
    expect(badge).toHaveAttribute("data-state", "hover");
    fireEvent.mouseLeave(badge);
    expect(badge).toHaveAttribute("data-state", "default");
  });

  it("toggles glyph and supplied level on click", () => {
    render(<VibeBadge vibe="endurance" label="Endurance" level="12.4" />);
    const badge = screen.getByRole("button", { name: "Endurance. Show level" });

    expect(badge).toHaveAttribute("data-content", "icon");
    fireEvent.click(badge);

    const revealed = screen.getByRole("button", {
      name: "Endurance: 12.4. Show vibe icon",
    });
    expect(revealed).toHaveAttribute("data-content", "level");
    expect(revealed).toHaveAttribute("data-state", "default");
    expect(screen.getByText("12.4")).toBeVisible();
  });

  it("supports all six existing vibe glyphs", () => {
    const vibes = [
      "strength",
      "agility",
      "endurance",
      "explosivity",
      "intelligence",
      "regeneration",
    ] as const;

    for (const vibe of vibes) {
      const { unmount } = render(<VibeBadge vibe={vibe} label={vibe} level="10.0" />);
      expect(screen.getByRole("button", { name: `${vibe}. Show level` })).toHaveAttribute(
        "data-vibe",
        vibe,
      );
      unmount();
    }
  });

  it("does not invent a level when none is supplied", () => {
    render(<VibeBadge vibe="agility" label="Agility" />);
    const badge = screen.getByRole("button", { name: "Agility" });

    fireEvent.click(badge);
    expect(badge).toHaveAttribute("data-content", "icon");
    expect(badge).not.toHaveAttribute("aria-pressed");
  });
});
