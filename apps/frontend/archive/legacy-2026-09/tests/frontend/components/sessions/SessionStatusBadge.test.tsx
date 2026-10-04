import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionStatusBadge } from "../../src/components/sessions/SessionStatusBadge";

describe("SessionStatusBadge", () => {
  it("renders label for status", () => {
    render(<SessionStatusBadge status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
