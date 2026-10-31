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

  it("announces an insufficient length without treating it as server approval", () => {
    render(<PasswordStrengthFeedback password="short" />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("status")).toHaveTextContent("passwordStrength.tooShort:12");
    expect(screen.getByText("passwordStrength.serverChecks")).toBeInTheDocument();
  });

  it("handles repeated or common patterns as weak regardless of length", () => {
    const { rerender } = render(<PasswordStrengthFeedback password="aaaaaaaaaaaaaaaaaaaaaaaa" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "1");
    rerender(<PasswordStrengthFeedback password="password123456789012345" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "1");
  });

  it("updates the accessible meter as a password changes", () => {
    const { rerender } = render(<PasswordStrengthFeedback password="a-sample-string" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "2");
    rerender(<PasswordStrengthFeedback password="four unrelated sample words together" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "passwordStrength.levels.strong",
    );
  });
});
