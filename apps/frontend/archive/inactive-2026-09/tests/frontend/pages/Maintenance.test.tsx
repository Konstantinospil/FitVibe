import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import Maintenance from "../../src/pages/Maintenance";

vi.mock("../../src/assets/logo_full_dark.png", () => ({
  default: "logo_full_dark.png",
}));
vi.mock("../../src/assets/Maintenance.png", () => ({
  default: "Maintenance.png",
}));

describe("Maintenance", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders maintenance section with heading", () => {
    render(<Maintenance />);
    expect(
      screen.getByRole("heading", { name: /FitVibe is currently down for maintenance/i }),
    ).toBeInTheDocument();
  });

  it("renders Maintenance eyebrow text", () => {
    render(<Maintenance />);
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
  });

  it("renders FitVibe logo with correct alt", () => {
    render(<Maintenance />);
    const logo = screen.getByRole("img", { name: "FitVibe" });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "logo_full_dark.png");
  });

  it("renders maintenance illustration with accessible alt", () => {
    render(<Maintenance />);
    expect(
      screen.getByRole("img", {
        name: "Athlete building the fitvibe logo during maintenance",
      }),
    ).toBeInTheDocument();
  });

  it("uses article landmark for card", () => {
    render(<Maintenance />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });
});
