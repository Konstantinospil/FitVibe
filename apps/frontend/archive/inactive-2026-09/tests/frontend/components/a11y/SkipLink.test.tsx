import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkipLink } from "../../src/components/a11y/SkipLink";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SkipLink", () => {
  it("renders a skip link targeting main content", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "navigation.skipToContent" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(link).toHaveClass("skip-link");
  });

  it("moves into view on focus and restores on blur", () => {
    render(<SkipLink />);

    const link = screen.getByRole("link", { name: "navigation.skipToContent" });
    fireEvent.focus(link);
    expect(link.style.top).toBe("0px");

    fireEvent.blur(link);
    expect(link.style.top).toBe("-40px");
  });

  it("focuses and scrolls the target on click", () => {
    const target = document.createElement("div");
    target.id = "custom-main";
    target.tabIndex = -1;
    target.focus = vi.fn();
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(<SkipLink href="#custom-main" targetId="custom-main" />);

    fireEvent.click(screen.getByRole("link", { name: "navigation.skipToContent" }));

    expect(target.focus).toHaveBeenCalled();
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    target.remove();
  });

  it("does nothing when the target is missing", () => {
    render(<SkipLink targetId="missing" />);

    expect(() =>
      fireEvent.click(screen.getByRole("link", { name: "navigation.skipToContent" })),
    ).not.toThrow();
  });
});
