import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardShortcuts } from "../../src/components/a11y/KeyboardShortcuts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("KeyboardShortcuts", () => {
  it("opens the default shortcuts modal", () => {
    render(<KeyboardShortcuts />);

    fireEvent.click(screen.getByRole("button", { name: "keyboardShortcuts.show" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("keyboardShortcuts.navigation")).toBeInTheDocument();
    expect(screen.getByText("keyboardShortcuts.actions")).toBeInTheDocument();
    expect(screen.getByText("keyboardShortcuts.focusSearch")).toBeInTheDocument();
    expect(screen.queryByText("Arrow")).not.toBeInTheDocument();
  });

  it("renders custom uncategorized shortcuts and a custom trigger label", () => {
    render(
      <KeyboardShortcuts
        triggerLabel="Help"
        shortcuts={[{ keys: ["Ctrl", "S"], description: "Save" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
