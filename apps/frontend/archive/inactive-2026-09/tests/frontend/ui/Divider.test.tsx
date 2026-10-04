import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Divider } from "../../src/components/ui/Divider";

describe("Divider", () => {
  it("renders a horizontal separator by default", () => {
    render(<Divider />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("renders a vertical separator", () => {
    render(<Divider orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("renders a labelled horizontal divider", () => {
    render(<Divider label="or" />);
    expect(screen.getByText("or")).toBeInTheDocument();
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });
});
