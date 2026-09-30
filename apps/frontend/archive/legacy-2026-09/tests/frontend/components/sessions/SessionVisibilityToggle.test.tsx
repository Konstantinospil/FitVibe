import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionVisibilityToggle } from "../../src/components/sessions/SessionVisibilityToggle";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("SessionVisibilityToggle", () => {
  it("renders all visibility options and the current badge", () => {
    render(<SessionVisibilityToggle value="private" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /visibility.labels.private/i })).toHaveAttribute(
      "data-variant",
      "primary",
    );
    expect(
      screen.getByRole("button", { name: /visibility.labels.followers/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /visibility.labels.link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /visibility.labels.public/i })).toBeInTheDocument();
  });

  it("calls onChange when a different option is selected", () => {
    const onChange = vi.fn();
    render(<SessionVisibilityToggle value="private" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /visibility.labels.public/i }));
    expect(onChange).toHaveBeenCalledWith("public");
  });

  it("disables options while loading and hides the badge for followers", () => {
    render(<SessionVisibilityToggle value="followers" onChange={vi.fn()} isLoading />);

    expect(screen.getByRole("button", { name: /visibility.labels.private/i })).toBeDisabled();
  });
});
