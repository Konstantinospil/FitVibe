import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "../../src/pages/Settings";
import * as api from "../../src/services/api";
import * as vibeApi from "../../src/lib/vibeform/api";
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
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  };
});

vi.mock("../../src/lib/vibeform/api", () => ({
  getMyVibeformProfile: vi.fn(),
  updateMyVibeformPreferences: vi.fn(),
}));

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
      weight: 75,
      weightUnit: "kg",
      fitnessLevel: "intermediate",
      trainingFrequency: "3_4_per_week",
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
    vi.mocked(api.uploadAvatar).mockResolvedValue({
      success: true,
      fileUrl: "/api/v1/users/avatar/u1",
      bytes: 128,
      mimeType: "image/png",
      updatedAt: "2026-10-10T00:00:00.000Z",
      preview: "data:image/png;base64,preview",
    });
    vi.mocked(api.deleteAvatar).mockResolvedValue();
    vi.mocked(vibeApi.getMyVibeformProfile).mockResolvedValue({
      preferences: { templateCode: "flow", templateVersion: 1, bodyProfile: "balanced", motionEnabled: true },
      metrics: {
        intelligence: 0.4,
        regeneration: 0.5,
        agility: 0.6,
        explosivity: 0.7,
        endurance: 0.8,
        strength: 0.9,
        upperBodyLoad: 0.5,
        lowerBodyLoad: 0.5,
        bmi: null,
        heightCm: null,
      },
      calculationVersion: "2",
      calculatedAt: "2026-10-04T00:00:00.000Z",
    });
    vi.mocked(vibeApi.updateMyVibeformPreferences).mockResolvedValue({
      templateCode: "flow",
      templateVersion: 1,
      bodyProfile: "hip-dominant",
      motionEnabled: false,
    });
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

  it("shows an accessible avatar placeholder when no avatar exists", async () => {
    renderSettings();

    const placeholder = await screen.findByTestId("avatar-placeholder");
    expect(placeholder).toHaveAttribute("aria-label", "Athlete");
    expect(placeholder).toHaveAttribute("data-size", "lg");
    expect(placeholder).toHaveAttribute("data-format", "initials");
    expect(placeholder).toHaveAttribute("data-status", "unknown");
    expect(placeholder.querySelector("[data-slot='status-dot']")).not.toBeInTheDocument();
    expect(screen.getByLabelText("settings.profile.avatarSelect")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
  });

  it("uploads a selected avatar and refreshes the profile", async () => {
    renderSettings();

    const input = await screen.findByLabelText("settings.profile.avatarSelect");
    const file = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    const upload = await screen.findByRole("button", { name: "settings.profile.avatarUpload" });
    fireEvent.click(upload);

    await waitFor(() => {
      expect(api.uploadAvatar).toHaveBeenCalledWith(file, expect.any(String));
    });
    await waitFor(() => {
      expect(api.getCurrentUser).toHaveBeenCalledTimes(2);
    });
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

  it("edits weight, fitness level and training frequency through the profile API", async () => {
    renderSettings();

    const weight = await screen.findByLabelText("settings.profile.weight");
    const fitnessLevel = screen.getByLabelText("settings.profile.fitnessLevel");
    const trainingFrequency = screen.getByLabelText("settings.profile.trainingFrequency");

    expect(weight).toHaveValue(75);

    fireEvent.change(weight, { target: { value: "80.5" } });
    fireEvent.change(fitnessLevel, { target: { value: "advanced" } });
    fireEvent.change(trainingFrequency, { target: { value: "5_plus_per_week" } });
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[0]);

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          weight: 80.5,
          weightUnit: "kg",
          fitnessLevel: "advanced",
          trainingFrequency: "5_plus_per_week",
        }),
      );
    });
  });

  it("displays stored kg weight in pounds for imperial preferences and saves pounds", async () => {
    vi.mocked(api.getUserPreferences).mockResolvedValue({
      language: "en",
      measurementSystem: "imperial",
    });

    renderSettings();

    const weight = await screen.findByLabelText("settings.profile.weight");
    expect(weight).toHaveValue(165.35);

    fireEvent.change(weight, { target: { value: "170" } });
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[0]);

    await waitFor(() => {
      expect(api.updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          weight: 170,
          weightUnit: "lb",
        }),
      );
    });
  });

  it("persists Vibeform preferences through the canonical profile API", async () => {
    renderSettings();

    const bodyProfile = await screen.findByLabelText("settings.vibeform.bodyProfile");
    fireEvent.change(bodyProfile, { target: { value: "hip-dominant" } });
    fireEvent.click(screen.getByRole("switch", { name: "settings.vibeform.motion" }));
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[1]);

    await waitFor(() => {
      expect(vibeApi.updateMyVibeformPreferences).toHaveBeenCalledWith({
        templateCode: "flow",
        bodyProfile: "hip-dominant",
        motionEnabled: false,
      });
    });
  });

  it("persists privacy toggles through the canonical privacy API", async () => {
    renderSettings();
    const followers = await screen.findByRole("switch", {
      name: "settings.privacy.allowFollowers",
    });
    fireEvent.click(followers);
    fireEvent.click(screen.getAllByRole("button", { name: "common.save" })[2]);

    await waitFor(() => {
      expect(api.updatePrivacySettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowFollowers: false }),
      );
    });
  });
});

export {};
