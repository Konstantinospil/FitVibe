import React, { forwardRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextLink } from "../../../packages/ui/src/TextLink";

describe("TextLink", () => {
  it("renders the active Figma state by default", () => {
    render(<TextLink href="/example">Link</TextLink>);
    const link = screen.getByRole("link", { name: "Link" });

    expect(link).toHaveAttribute("data-state", "active");
    expect(link).toHaveStyle({
      color: "var(--color-info-text)",
      textDecorationLine: "underline",
      opacity: "var(--opacity-full)",
    });
  });

  it("uses clicked state while pressed", () => {
    render(<TextLink href="/example">Link</TextLink>);
    const link = screen.getByRole("link", { name: "Link" });

    fireEvent.mouseDown(link);
    expect(link).toHaveAttribute("data-state", "clicked");
    expect(link).toHaveStyle({ color: "var(--color-text-primary)" });

    fireEvent.mouseUp(link);
    expect(link).toHaveAttribute("data-state", "active");
  });

  it("renders inactive state and blocks activation", () => {
    const onClick = vi.fn();
    render(
      <TextLink href="/example" inactive onClick={onClick}>
        Link
      </TextLink>,
    );

    const link = screen.getByText("Link");
    expect(link).toHaveAttribute("data-state", "inactive");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).toHaveStyle({ opacity: "var(--opacity-disabled)" });

    fireEvent.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("supports router-like components through the as/to API", () => {
    const RouterStub = forwardRef<HTMLAnchorElement, { to?: string; children?: React.ReactNode }>(
      ({ to, children, ...rest }, ref) => (
        <a ref={ref} href={to} {...rest}>
          {children}
        </a>
      ),
    );
    RouterStub.displayName = "RouterStub";

    render(
      <TextLink as={RouterStub} to="/router">
        Router Link
      </TextLink>,
    );

    expect(screen.getByRole("link", { name: "Router Link" })).toHaveAttribute(
      "href",
      "/router",
    );
  });
});
