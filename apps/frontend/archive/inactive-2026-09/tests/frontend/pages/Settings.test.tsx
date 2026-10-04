import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderSettings, setupSettingsTests } from "./Settings.test.helpers";

describe("Settings", () => {
  beforeEach(() => {
    setupSettingsTests();
  });

  it("renders the modular settings navigation and profile", async () => {
    const { mockGetCurrentUser } = setupSettingsTests();
    renderSettings();

    expect(screen.getByRole("tab", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Progress/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Security/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Privacy/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(screen.getByTestId("preferences-settings")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
      expect(screen.getByDisplayValue("testalias")).toBeInTheDocument();
    });
  });

  it("switches to the Progress tab", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Progress/i }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "tabpanel-progress");
    expect(screen.getByRole("tab", { name: /Progress/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches to the Security tab", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Security/i }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "tabpanel-security");
  });

  it("switches to the Privacy tab", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Privacy/i }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "tabpanel-privacy");
  });
});
