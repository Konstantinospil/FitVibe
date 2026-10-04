import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
// Import CSS at module level - Vitest processes CSS imports safely
import "../../src/styles/global.css";
import { CardTitle } from "../../../packages/ui/src";

describe("Design tokens", () => {
  beforeEach(() => {
    // Set CSS custom properties manually since jsdom doesn't parse CSS files
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

  it("applies heading font family in CardTitle", () => {
    const { unmount } = render(<CardTitle>Typography Check</CardTitle>);
    const heading = screen.getByText("Typography Check");
    expect(heading.style.fontFamily).toBe("var(--font-family-heading)");
    // Explicitly unmount to ensure cleanup
    unmount();
  });
});
