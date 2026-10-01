import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "../../../packages/ui/src";

describe("Avatar", () => {
  it.each([
    ["sm", "48px"],
    ["lg", "96px"],
  ] as const)("implements the %s Figma size", (size, dimension) => {
    render(<Avatar name="Fit Vibe" size={size} data-testid="avatar" />);
    expect(screen.getByTestId("avatar")).toHaveStyle({
      width: dimension,
      height: dimension,
    });
  });

  it("renders initials format", () => {
    render(<Avatar name="Fit Vibe" format="initials" />);
    expect(screen.getByText("FV")).toBeInTheDocument();
  });

  it("renders photo format when an image is supplied", () => {
    render(<Avatar name="Fit Vibe" format="photo" src="/avatar.jpg" />);
    const image = screen.getByRole("img", { name: "Fit Vibe" });
    expect(image).toHaveAttribute("src", "/avatar.jpg");
  });

  it("falls back to initials when photo format has no source", () => {
    render(<Avatar name="Fit Vibe" format="photo" />);
    expect(screen.getByText("FV")).toBeInTheDocument();
  });

  it.each([
    ["online", "var(--color-success-text)"],
    ["offline", "var(--color-danger-text)"],
  ] as const)("uses embedded status color for compact initials: %s", (status, color) => {
    render(<Avatar name="Fit Vibe" size="sm" status={status} data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    const surface = avatar.querySelector("[data-slot='avatar-surface']");

    expect(avatar).toHaveAttribute("data-status-display", "embedded");
    expect(surface).toHaveStyle({ background: color });
    expect(avatar.querySelector("[data-slot='status-dot']")).not.toBeInTheDocument();
  });

  it.each([
    ["online", "var(--color-success-text)"],
    ["offline", "var(--color-danger-text)"],
  ] as const)("uses an embedded status ring for compact photos: %s", (status, color) => {
    render(
      <Avatar
        name="Fit Vibe"
        size="sm"
        format="photo"
        src="/avatar.jpg"
        status={status}
        data-testid="avatar"
      />,
    );

    const surface = screen
      .getByTestId("avatar")
      .querySelector<HTMLElement>("[data-slot='avatar-surface']");
    expect(surface).not.toBeNull();
    expect(surface?.style.borderWidth).toBe("3px");
    expect(surface?.style.borderStyle).toBe("solid");
    expect(surface?.getAttribute("style")).toContain(`border-color: ${color}`);
  });

  it.each([
    ["online", "var(--color-success-text)"],
    ["offline", "var(--color-danger-text)"],
  ] as const)("uses a separate status dot for large avatars: %s", (status, color) => {
    render(<Avatar name="Fit Vibe" size="lg" status={status} data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    const dot = avatar.querySelector("[data-slot='status-dot']");

    expect(avatar).toHaveAttribute("data-status-display", "dot");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ background: color });
  });

  it("renders unknown status without an accent or dot", () => {
    render(<Avatar name="Fit Vibe" size="lg" status="unknown" data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    const surface = avatar.querySelector("[data-slot='avatar-surface']");

    expect(avatar).toHaveAttribute("data-status", "unknown");
    expect(avatar.querySelector("[data-slot='status-dot']")).not.toBeInTheDocument();
    expect(surface).toHaveStyle({ background: "var(--color-surface)" });
  });

  it("allows overriding the status presentation mode", () => {
    render(
      <Avatar
        name="Fit Vibe"
        size="sm"
        status="online"
        statusDisplay="dot"
        data-testid="avatar"
      />,
    );

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-status-display", "dot");
    expect(avatar.querySelector("[data-slot='status-dot']")).toBeInTheDocument();
  });

  it("builds initials from the first two words", () => {
    render(<Avatar name="Fit Vibe Athlete" />);
    expect(screen.getByText("FV")).toBeInTheDocument();
  });
});
