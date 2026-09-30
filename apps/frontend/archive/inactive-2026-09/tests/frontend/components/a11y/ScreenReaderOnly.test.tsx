import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenReaderOnly } from "../../src/components/a11y/ScreenReaderOnly";

describe("ScreenReaderOnly", () => {
  it("renders children in a visually hidden span by default", () => {
    render(<ScreenReaderOnly>Hidden label</ScreenReaderOnly>);

    const element = screen.getByText("Hidden label");
    expect(element.tagName).toBe("SPAN");
    expect(element).toHaveStyle({
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
    });
  });

  it("renders as a custom element when as is provided", () => {
    render(<ScreenReaderOnly as="h2">Section title</ScreenReaderOnly>);

    expect(screen.getByRole("heading", { level: 2, name: "Section title" })).toBeInTheDocument();
  });
});
