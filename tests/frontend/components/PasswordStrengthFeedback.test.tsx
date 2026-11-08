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
