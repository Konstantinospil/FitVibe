import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsTabs } from "../../src/components/profile/SettingsTabs";

describe("SettingsTabs", () => {
  it("renders the profile tab by default", () => {
    render(
      <SettingsTabs
        profileContent={<div>Profile body</div>}
        securityContent={<div>Security body</div>}
        privacyContent={<div>Privacy body</div>}
      />,
    );

    expect(screen.getByText("Profile body")).toBeInTheDocument();
    expect(screen.queryByText("Security body")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Profile/ })).toHaveAttribute("aria-selected", "true");
  });

  it("notifies when the active tab changes", () => {
    const onValueChange = vi.fn();
    render(
      <SettingsTabs
        onValueChange={onValueChange}
        profileContent={<div>Profile body</div>}
        securityContent={<div>Security body</div>}
        privacyContent={<div>Privacy body</div>}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Privacy/ }));
    expect(onValueChange).toHaveBeenCalledWith("privacy");
    expect(screen.getByText("Privacy body")).toBeInTheDocument();
  });

  it("supports a controlled value", () => {
    render(
      <SettingsTabs
        value="security"
        profileContent={<div>Profile body</div>}
        securityContent={<div>Security body</div>}
        privacyContent={<div>Privacy body</div>}
      />,
    );

    expect(screen.getByText("Security body")).toBeInTheDocument();
  });
});
