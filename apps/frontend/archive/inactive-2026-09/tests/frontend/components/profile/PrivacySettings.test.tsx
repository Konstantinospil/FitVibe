import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySettings } from "../../src/components/profile/PrivacySettings";

const getPrivacySettings = vi.fn();
const updatePrivacySettings = vi.fn();
const showToast = vi.fn();
const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  getPrivacySettings: (...args: unknown[]) => getPrivacySettings(...args),
  updatePrivacySettings: (...args: unknown[]) => updatePrivacySettings(...args),
}));

const settings = {
  defaultVisibility: "private" as const,
  allowFollowers: true,
  showEmail: false,
  showWeight: false,
  showFitnessLevel: false,
};

describe("PrivacySettings", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
    getPrivacySettings.mockReset().mockResolvedValue(settings);
    updatePrivacySettings.mockReset().mockResolvedValue(settings);
    showToast.mockReset();
  });

  it("shows a loading state then the settings form", async () => {
    render(<PrivacySettings />);
    expect(await screen.findByTestId("privacy-settings")).toBeInTheDocument();
    expect(screen.getByText("settings.privacy.title")).toBeInTheDocument();
  });

  it("shows a load error when the request fails", async () => {
    getPrivacySettings.mockRejectedValue(new Error("fail"));
    render(<PrivacySettings />);

    expect(await screen.findByText("settings.privacy.loadError")).toBeInTheDocument();
  });

  it("saves updated settings", async () => {
    const onUpdate = vi.fn();
    render(<PrivacySettings onUpdate={onUpdate} />);
    await screen.findByTestId("privacy-settings");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "public" } });
    fireEvent.click(screen.getByRole("switch", { name: "settings.privacy.allowFollowers" }));
    fireEvent.click(screen.getByRole("switch", { name: "settings.privacy.showEmail" }));
    fireEvent.click(screen.getByRole("switch", { name: "settings.privacy.showWeight" }));
    fireEvent.click(screen.getByRole("switch", { name: "settings.privacy.showFitnessLevel" }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(updatePrivacySettings).toHaveBeenCalledWith({
        ...settings,
        defaultVisibility: "public",
        allowFollowers: false,
        showEmail: true,
        showWeight: true,
        showFitnessLevel: true,
      }),
    );
    expect(onUpdate).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "settings.privacy.saved",
      message: "settings.privacy.savedMessage",
    });
  });

  it("shows a save error when the update fails", async () => {
    updatePrivacySettings.mockRejectedValue(new Error("fail"));
    render(<PrivacySettings />);
    await screen.findByTestId("privacy-settings");

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(await screen.findByText("settings.privacy.saveError")).toBeInTheDocument();
  });

  it("uses English copy when translations are empty", async () => {
    tState.impl = () => "";
    render(<PrivacySettings />);
    expect(await screen.findByText("Privacy Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Control who can see your content and profile information"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});
