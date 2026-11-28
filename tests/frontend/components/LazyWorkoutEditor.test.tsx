import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LazyWorkoutEditor } from "../../src/components/composites/LazyWorkoutEditor";

const loaded = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../src/components/composites/WorkoutEditor", () => {
  loaded.count += 1;
  return { default: () => <div>editor loaded</div> };
});

describe("LazyWorkoutEditor", () => {
  it("renders nothing and downloads nothing until it opens", async () => {
    const { rerender } = render(<LazyWorkoutEditor open={false} onClose={() => undefined} />);
    expect(screen.queryByText("editor loaded")).not.toBeInTheDocument();
    expect(loaded.count).toBe(0);

    rerender(<LazyWorkoutEditor open onClose={() => undefined} />);
    expect(await screen.findByText("editor loaded")).toBeInTheDocument();
    expect(loaded.count).toBe(1);
  });
});
