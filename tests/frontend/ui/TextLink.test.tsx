import React, { forwardRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextLink } from "../../../packages/ui/src/TextLink";

describe("TextLink", () => {
  it("renders the design-system link contract by default", () => {
    render(<TextLink href="/example">Link</TextLink>);
    const link = screen.getByRole("link", { name: "Link" });

    expect(link).toHaveAttribute("data-component", "text-link");
    expect(link).not.toHaveAttribute("aria-disabled");
  });

  it("delegates pressed presentation to CSS and preserves activation", () => {
    const onClick = vi.fn();
    render(
      <TextLink href="/example" onClick={onClick}>
        Link
      </TextLink>,
    );

    const link = screen.getByRole("link", { name: "Link" });
    fireEvent.mouseDown(link);
    fireEvent.mouseUp(link);
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders inactive semantics and blocks activation", () => {
    const onClick = vi.fn();
    render(
      <TextLink href="/example" inactive onClick={onClick}>
        Link
      </TextLink>,
    );

    const link = screen.getByText("Link");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");

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
