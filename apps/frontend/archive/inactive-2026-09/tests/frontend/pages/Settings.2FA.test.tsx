import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderSettings, setupSettingsTests } from "./Settings.test.helpers";

describe("Settings - Security", () => {
  beforeEach(() => setupSettingsTests());

  it("shows the Security tab content", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Security/i }));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "tabpanel-security");
    expect(screen.getByText(/Two-Factor Authentication \(2FA\)/i)).toBeInTheDocument();
  });

  it("offers the 2FA setup action", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: /Security/i }));
    expect(
      await screen.findByRole("button", { name: /enable.*2FA/i }),
    ).toBeInTheDocument();
  });
});
