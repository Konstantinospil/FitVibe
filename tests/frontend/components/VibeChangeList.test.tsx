import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VibeChangeList } from "../../src/components/domain/VibeChangeList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "value" in options ? `${key}=${String(options.value)}` : key,
    i18n: { language: "en" },
  }),
}));

describe("VibeChangeList", () => {
  it("lists each Vibe with its icon, new level and signed change", () => {
    render(
      <VibeChangeList
        changes={[
          { vibe: "regeneration", newLevel: 999.4, change: -1 },
          { vibe: "strength", newLevel: 1012.5, change: 12.5 },
          { vibe: "agility", newLevel: 1000, change: 0 },
        ]}
      />,
    );

    const rows = screen.getAllByRole("listitem");
    // Canonical Vibe order, whatever order the changes came in.
    expect(rows.map((row) => within(row).getByText(/^vibes\./).textContent)).toEqual([
      "vibes.strength.name",
      "vibes.agility.name",
      "vibes.regeneration.name",
    ]);
    expect(within(rows[0]).getByText("vibeChanges.level=1,013")).toBeInTheDocument();
    expect(within(rows[0]).getByText("+12.5")).toBeInTheDocument();
    expect(within(rows[1]).getByText("0")).toBeInTheDocument();
    expect(within(rows[2]).getByText("-1")).toBeInTheDocument();
    expect(rows[2]).toHaveAttribute("data-direction", "-1");
    // The icon is decorative; the name carries the meaning.
    expect(rows[0].querySelector('[data-slot="vibe-icon"]')).toHaveAttribute("aria-hidden", "true");
  });
});
