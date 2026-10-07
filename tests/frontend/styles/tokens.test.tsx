import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import "../../src/styles/global.css";
import { CardTitle } from "../../../packages/ui/src";

describe("Design tokens", () => {
  beforeEach(() => {
    document.documentElement.style.setProperty(
      "--font-family-base",
      '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif',
    );
    document.documentElement.style.setProperty("--color-accent", "#34d399");
    document.documentElement.style.setProperty("--font-size-lg", "1.125rem");
  });

  it("exposes core font and color custom properties", () => {
    const rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue("--font-family-base").trim()).not.toBe("");
    expect(rootStyle.getPropertyValue("--color-accent").trim()).toBe("#34d399");
    expect(rootStyle.getPropertyValue("--font-size-lg").trim()).toBe("1.125rem");
  });

  it("marks CardTitle as the canonical card-title component", () => {
    const { unmount } = render(<CardTitle>Typography Check</CardTitle>);
    expect(screen.getByText("Typography Check")).toHaveAttribute("data-component", "card-title");
    unmount();
  });
});
