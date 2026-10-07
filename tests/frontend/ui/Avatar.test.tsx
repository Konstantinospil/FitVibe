import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "../../../packages/ui/src";

describe("Avatar", () => {
  it.each(["sm", "lg"] as const)("exposes the %s design-system size", (size) => {
    render(<Avatar name="Fit Vibe" size={size} data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-component", "avatar");
    expect(avatar).toHaveAttribute("data-size", size);
  });

  it("renders initials format", () => {
    render(<Avatar name="Fit Vibe" format="initials" />);
    expect(screen.getByText("FV")).toBeInTheDocument();
  });

  it("renders photo format when an image is supplied", () => {
    render(<Avatar name="Fit Vibe" format="photo" src="/avatar.jpg" />);
    expect(screen.getByRole("img", { name: "Fit Vibe" })).toHaveAttribute("src", "/avatar.jpg");
  });

  it("falls back to initials when photo format has no source", () => {
    render(<Avatar name="Fit Vibe" format="photo" />);
    expect(screen.getByText("FV")).toBeInTheDocument();
  });

  it.each(["online", "offline"] as const)(
    "uses embedded status for compact initials: %s",
    (status) => {
      render(<Avatar name="Fit Vibe" size="sm" status={status} data-testid="avatar" />);
      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveAttribute("data-status", status);
      expect(avatar).toHaveAttribute("data-status-display", "embedded");
      expect(avatar.querySelector("[data-slot='status-dot']")).not.toBeInTheDocument();
    },
  );

  it.each(["online", "offline"] as const)(
    "uses an embedded status ring contract for compact photos: %s",
    (status) => {
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

      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveAttribute("data-format", "photo");
      expect(avatar).toHaveAttribute("data-status", status);
      expect(avatar).toHaveAttribute("data-status-display", "embedded");
    },
  );

  it.each(["online", "offline"] as const)(
    "uses a separate status dot for large avatars: %s",
    (status) => {
      render(<Avatar name="Fit Vibe" size="lg" status={status} data-testid="avatar" />);
      const avatar = screen.getByTestId("avatar");
      expect(avatar).toHaveAttribute("data-status", status);
      expect(avatar).toHaveAttribute("data-status-display", "dot");
      expect(avatar.querySelector("[data-slot='status-dot']")).toBeInTheDocument();
    },
  );

  it("renders unknown status without a dot", () => {
    render(<Avatar name="Fit Vibe" size="lg" status="unknown" data-testid="avatar" />);
    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-status", "unknown");
    expect(avatar.querySelector("[data-slot='status-dot']")).not.toBeInTheDocument();
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
