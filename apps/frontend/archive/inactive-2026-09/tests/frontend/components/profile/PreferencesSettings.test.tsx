import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesSettings } from "../../src/components/profile/PreferencesSettings";

const getUserPreferences = vi.fn();
const updateUserPreferences = vi.fn();
const loadLanguageTranslations = vi.fn();
const changeLanguage = vi.fn();
const showToast = vi.fn();
const translate = (key: string) => key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("../../src/i18n/config", () => ({
  default: { changeLanguage: (...args: unknown[]) => changeLanguage(...args) },
  loadLanguageTranslations: (...args: unknown[]) => loadLanguageTranslations(...args),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  getUserPreferences: (...args: unknown[]) => getUserPreferences(...args),
  updateUserPreferences: (...args: unknown[]) => updateUserPreferences(...args),
}));

describe("PreferencesSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserPreferences.mockResolvedValue({ language: "en", measurementSystem: "metric" });
    updateUserPreferences.mockResolvedValue({ language: "de", measurementSystem: "imperial" });
    loadLanguageTranslations.mockResolvedValue(undefined);
    changeLanguage.mockResolvedValue(undefined);
  });

  it("loads and saves language and measurement preferences", async () => {
    const onUpdate = vi.fn();
    render(<PreferencesSettings onUpdate={onUpdate} />);

    expect(await screen.findByTestId("preferences-settings")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    expect(selects[0]).toHaveValue("en");
    expect(selects[1]).toHaveValue("metric");

    fireEvent.change(selects[0], { target: { value: "de" } });
    fireEvent.change(selects[1], { target: { value: "imperial" } });
    fireEvent.click(screen.getByRole("button", { name: "settings.preferences.saveButton" }));

    await waitFor(() =>
      expect(updateUserPreferences).toHaveBeenCalledWith({
        language: "de",
        measurementSystem: "imperial",
      }),
    );
    expect(loadLanguageTranslations).toHaveBeenCalledWith("de");
    expect(changeLanguage).toHaveBeenCalledWith("de");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows load and save failures", async () => {
    getUserPreferences.mockRejectedValueOnce(new Error("load failed"));
    const { unmount } = render(<PreferencesSettings />);
    expect(await screen.findByText("settings.preferences.loadError")).toBeInTheDocument();
    unmount();

    getUserPreferences.mockResolvedValueOnce({ language: "en", measurementSystem: "metric" });
    updateUserPreferences.mockRejectedValueOnce(new Error("save failed"));
    render(<PreferencesSettings />);
    await screen.findByTestId("preferences-settings");
    fireEvent.click(screen.getByRole("button", { name: "settings.preferences.saveButton" }));
    expect(await screen.findByText("settings.preferences.saveError")).toBeInTheDocument();
  });
});
