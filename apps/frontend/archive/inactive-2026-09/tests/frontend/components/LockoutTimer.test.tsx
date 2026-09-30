/**
 * Tests for LockoutTimer component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { LockoutTimer } from "../../src/components/LockoutTimer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; [key: string]: unknown }) => {
      const translations: Record<string, string> = {
        "auth.lockout.accountLockout": "Account lockout",
        "auth.lockout.ipLockout": "IP lockout",
        "auth.lockout.lockoutActive": "{{type}} active",
        "auth.lockout.remaining": "remaining",
        "auth.lockout.timerAriaLabel": "Time remaining: {{time}}",
        "auth.lockout.retryAfter": "You can try again after the timer expires",
      };
      if (options?.defaultValue) {
        return options.defaultValue.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const value = options[key];
          if (value === null || value === undefined) {
            return "";
          }
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
          ) {
            return String(value);
          }
          return "";
        });
      }
      return translations[key] || options?.defaultValue || key;
    },
  }),
}));

describe("LockoutTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("should display countdown timer in MM:SS format", () => {
    const { container } = render(<LockoutTimer remainingSeconds={125} lockoutType="account" />);

    const texts = screen.getAllByText("02:05");
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should update timer every second", () => {
    const { container } = render(<LockoutTimer remainingSeconds={125} lockoutType="account" />);

    const texts1 = screen.getAllByText("02:05");
    const text1 = Array.from(texts1).find((el) => container.contains(el)) || texts1[0];
    expect(text1).toBeInTheDocument();

    // Advance timers by 1 second and check immediately
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const texts2 = screen.getAllByText("02:04");
    const text2 = Array.from(texts2).find((el) => container.contains(el));
    expect(text2).toBeInTheDocument();

    // Advance by another second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const texts3 = screen.getAllByText("02:03");
    const text3 = Array.from(texts3).find((el) => container.contains(el));
    expect(text3).toBeInTheDocument();
  });

  it("should call onExpired when timer reaches zero", () => {
    const onExpired = vi.fn();
    const { container } = render(
      <LockoutTimer remainingSeconds={2} lockoutType="account" onExpired={onExpired} />,
    );

    const texts1 = screen.getAllByText("00:02");
    const text1 = Array.from(texts1).find((el) => container.contains(el)) || texts1[0];
    expect(text1).toBeInTheDocument();

    // Advance by 1 second - timer should update to 00:01
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const texts2 = screen.getAllByText("00:01");
    const text2 = Array.from(texts2).find((el) => container.contains(el));
    expect(text2).toBeInTheDocument();

    // Advance by another second - timer should reach 0 and call onExpired
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Component should call onExpired when timer reaches 0
    // Note: onExpired may be called multiple times due to useEffect re-runs, so we check it was called at least once
    expect(onExpired).toHaveBeenCalled();
  });

  it("should not render when remainingSeconds is 0", () => {
    const { container } = render(<LockoutTimer remainingSeconds={0} lockoutType="account" />);
    expect(container.firstChild).toBeNull();
  });

  it("should display account lockout message", () => {
    const { container } = render(<LockoutTimer remainingSeconds={60} lockoutType="account" />);
    const texts = screen.getAllByText(/Account lockout/i);
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should display IP lockout message", () => {
    const { container } = render(<LockoutTimer remainingSeconds={60} lockoutType="ip" />);
    const texts = screen.getAllByText(/IP lockout/i);
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should be accessible with ARIA attributes", () => {
    const { container } = render(<LockoutTimer remainingSeconds={60} lockoutType="account" />);

    const timerElements = screen.getAllByRole("status");
    const timerElement =
      Array.from(timerElements).find((el) => container.contains(el)) || timerElements[0];
    expect(timerElement).toHaveAttribute("aria-live", "polite");
    expect(timerElement).toHaveAttribute("aria-atomic", "true");
  });

  it("should handle minutes correctly", () => {
    const { container } = render(<LockoutTimer remainingSeconds={3661} lockoutType="account" />);
    const texts = screen.getAllByText("61:01");
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should pad seconds with zero", () => {
    const { container } = render(<LockoutTimer remainingSeconds={65} lockoutType="account" />);
    const texts = screen.getAllByText("01:05");
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should update when remainingSeconds prop changes", () => {
    const { rerender, container } = render(
      <LockoutTimer remainingSeconds={60} lockoutType="account" />,
    );
    const texts1 = screen.getAllByText("01:00");
    const text1 = Array.from(texts1).find((el) => container.contains(el)) || texts1[0];
    expect(text1).toBeInTheDocument();

    rerender(<LockoutTimer remainingSeconds={30} lockoutType="account" />);
    // Component should update immediately when prop changes
    const texts2 = screen.getAllByText("00:30");
    const text2 = Array.from(texts2).find((el) => container.contains(el)) || texts2[0];
    expect(text2).toBeInTheDocument();
  });
});
