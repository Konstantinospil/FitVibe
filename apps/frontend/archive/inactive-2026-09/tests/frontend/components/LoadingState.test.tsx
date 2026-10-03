import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "../../src/components/utils/LoadingState";

describe("LoadingState", () => {
  it("renders a loading spinner by default", () => {
    render(<LoadingState />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders a custom message when provided", () => {
    render(<LoadingState message="Fetching sessions" />);

    expect(screen.getByText("Fetching sessions")).toBeInTheDocument();
  });

  it("hides message when message is empty", () => {
    render(<LoadingState message="" size="lg" />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders a full-screen overlay with a message", () => {
    render(<LoadingState fullScreen message="Please wait" />);
    expect(screen.getByText("Please wait")).toBeInTheDocument();
  });
});
