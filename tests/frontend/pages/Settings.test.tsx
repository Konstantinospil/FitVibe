import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "../../src/pages/Settings";
import * as api from "../../src/services/api";
import { cleanupQueryClient, createTestQueryClient } from "../helpers/testQueryClient";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    updateProfile: vi.fn(),
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
    getPrivacySettings: vi.fn(),
    updatePrivacySettings: vi.fn(),
    get2FAStatus: vi.fn(),
  };
});

describe("Settings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: "u1",
      username: "athlete",
      displayName: "Athlete",
      alias: "athlete",
      bio: "Training",
    });
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "metric",
    });
    vi.mocked(api.getPrivacySettings).mockResolvedValue({
      defaultVisibility: "private",
      allowFollowers: true,
      showEmail: false,
      showWeight: false,
      showFitnessLevel: false,
    });
    vi.mocked(api.get2FAStatus).mockResolvedValue({ enabled: true });
    vi.mocked(api.updateProfile).mockResolvedValue({
      id: "u1",
      username: "athlete",
      displayName: "Updated",
    });
    vi.mocked(api.updateUserPreferences).mockResolvedValue({
      language: "de",
      measurementSystem: "metric",
    });
    vi.mocked(api.updatePrivacySettings).mockResolvedValue({
      defaultVisibility: "private",
      allowFollowers: false,
      showEmail: false,
      showWeight: false,
      showFitnessLevel: false,
    });
  });

  afterEach(async () => {
    await cleanupQueryClient(queryClient);
    vi.clearAllMocks();
  });

  const renderSettings = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <Settings />
      </QueryClientProvider>,
    );

  it("loads only supported canonical Settings sections", async () => {
    renderSettings();
    expect(await screen.findByDisplayValue("Athlete")).toBeInTheDocument();
    expect(screen.getByText("settings.preferences.title")).toBeInTheDocument();
    expect(screen.getByText("settings.privacy.title")).toBeInTheDocument();
    expect(screen.getByText("settings.security.enabled")).toBeInTheDocument();
  });

  it("persists profile changes through the canonical account API", async () => {
    renderSettings();
    const displayName = await screen.findByLabelText("settings.profile.displayName");
    fireEvent.change(displayName, { target: { value: "Updated" } });
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[0]);

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: "Updated" }),
      );
    });
  });

  it("persists privacy toggles through the canonical privacy API", async () => {
    renderSettings();
    const followers = await screen.findByRole("switch", {
      name: "settings.privacy.allowFollowers",
    });
    fireEvent.click(followers);
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[1]);

    await waitFor(() => {
      expect(api.updatePrivacySettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowFollowers: false }),
      );
    });
  });
});

export {};
