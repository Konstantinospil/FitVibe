import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderSettings, setupSettingsTests } from "./Settings.test.helpers";

describe("Settings - Account", () => {
  beforeEach(() => setupSettingsTests());

  it("places account controls in the Privacy tab", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Privacy/i }));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "tabpanel-privacy");
    expect(
      screen.getByRole("button", { name: /delete.*account/i }),
    ).toBeInTheDocument();
  });

  it("opens the account deletion confirmation", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Privacy/i }));
    fireEvent.click(screen.getByRole("button", { name: /delete.*account/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
