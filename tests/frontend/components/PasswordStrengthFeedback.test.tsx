import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordStrengthFeedback } from "../../../apps/frontend/src/components/PasswordStrengthFeedback";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { minimum?: number }) =>
      options?.minimum ? `${key}:${options.minimum}` : key,
  }),
}));

describe("PasswordStrengthFeedback", () => {
  it("reserves the meter's rows before the estimator loads (issue 634 layout shift)", async () => {
    const { container } = render(<PasswordStrengthFeedback password="short" />);

    // Synchronously, in the same render as the keystroke: the invisible copy of
    // the meter's three rows is present, while the lazy meter is not yet.
    const slot = screen.getByTestId("password-strength-slot");
    const sizer = slot.querySelector(".password-strength-slot__sizer");
    expect(sizer).toHaveAttribute("aria-hidden", "true");
    expect(sizer?.querySelector(".password-strength-slot__bar")).not.toBeNull();
    expect(sizer?.querySelectorAll("p[data-sizer-text]")).toHaveLength(2);
    expect(sizer?.querySelector("p")?.getAttribute("data-sizer-text")).toContain(
      "passwordStrength.tooShort:12",
    );
    expect(container.querySelector('[data-component="password-strength"]')).toBeNull();

    // Once loaded, the meter occupies the same slot and is the only accessible
    // meter/status; the copy contributes no roles or DOM text.
    const meter = await screen.findByRole("meter");
    expect(slot).toContainElement(meter);
    expect(screen.getAllByRole("meter")).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByText("passwordStrength.serverChecks")).toHaveLength(1);
  });

  it("sizes the reserved row with the longest strength label", () => {
    render(<PasswordStrengthFeedback password="short" />);
    const firstRow = screen
      .getByTestId("password-strength-slot")
      .querySelector("p[data-sizer-text]");
    // The mocked labels are their keys; "passwordStrength.levels.veryWeak" is longest.
    expect(firstRow?.getAttribute("data-sizer-text")).toBe(
      "passwordStrength.levels.veryWeak — passwordStrength.tooShort:12",
    );
  });

  it("does not display a meter for an empty password", () => {
    const { container } = render(<PasswordStrengthFeedback password="" />);
    expect(container.querySelector('[data-component="password-strength"]')).toBeNull();
  });

  it("announces an insufficient length without treating it as server approval", async () => {
    render(<PasswordStrengthFeedback password="short" />);
    const meter = await screen.findByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("status")).toHaveTextContent("passwordStrength.tooShort:12");
    expect(screen.getByText("passwordStrength.serverChecks")).toBeInTheDocument();
  });

  it("handles repeated or common patterns as weak regardless of length", async () => {
    const { rerender } = render(<PasswordStrengthFeedback password="aaaaaaaaaaaaaaaaaaaaaaaa" />);
    await screen.findByRole("meter");
    expect(Number(screen.getByRole("meter").getAttribute("aria-valuenow"))).toBeLessThanOrEqual(2);
    rerender(<PasswordStrengthFeedback password="password" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "1");
  });

  it("updates the accessible meter as a password changes", async () => {
    const { rerender } = render(<PasswordStrengthFeedback password="password" />);
    await screen.findByRole("meter");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "1");
    rerender(<PasswordStrengthFeedback password="r9Q!5xmV@p7L#2tZ$4wN&6cR8yK" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "passwordStrength.levels.strong",
    );
  });
});
