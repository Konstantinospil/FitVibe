import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const updateProfile = vi.fn();
const showToast = vi.fn();

const t = (key: string) => key;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({
    showToast,
  }),
}));

vi.mock("../../src/services/api", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

describe("ProfileForm", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    updateProfile.mockReset();
    showToast.mockReset();
  });

  it("loads profile data and submits updates", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    let resolveProfile: (value: unknown) => void = () => {};
    const profilePromise = new Promise((resolve) => {
      resolveProfile = resolve;
    });
    getCurrentUser.mockImplementation(() => profilePromise);
    updateProfile.mockResolvedValue(undefined);
    const onSave = vi.fn();

    render(<ProfileForm onSave={onSave} />);

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    resolveProfile({
      displayName: "Alex",
      profile: {
        bio: "Runner",
        alias: "alex",
        weight: 70,
        weightUnit: "kg",
        fitnessLevel: "intermediate",
        trainingFrequency: "3_4_per_week",
      },
    });
    const displayNameInput = await screen.findByLabelText("settings.profile.displayName");
    expect(displayNameInput).toHaveValue("Alex");

    const saveButton = await screen.findByRole("button", { name: "common.save" });
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows error when profile load fails", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    let rejectProfile: (reason?: unknown) => void = () => {};
    const profilePromise = new Promise((_, reject) => {
      rejectProfile = reject;
    });
    getCurrentUser.mockImplementation(() => profilePromise);

    render(<ProfileForm />);
    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());
    rejectProfile(new Error("Load failed"));

    expect(await screen.findByText("Load failed")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalled();
  });

  it("shows loading spinner while profile data is loading", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    getCurrentUser.mockImplementation(
      () =>
        new Promise(() => {
          // keep pending to stay in loading state
        }),
    );

    const { container } = render(<ProfileForm />);

    expect(container.querySelector(".spinner")).toBeInTheDocument();
  });

  it("updates form fields and submits with parsed values", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    getCurrentUser.mockResolvedValue({ displayName: "Alex", profile: {} });
    updateProfile.mockResolvedValue(undefined);

    render(<ProfileForm />);

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("settings.profile.displayName"), {
      target: { value: "New Name" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.alias"), {
      target: { value: "new-alias" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.bio"), {
      target: { value: "Updated bio" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.weight"), {
      target: { value: "82.5" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.weightUnit"), {
      target: { value: "lb" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.fitnessLevel"), {
      target: { value: "advanced" },
    });
    fireEvent.change(screen.getByLabelText("settings.profile.trainingFrequency"), {
      target: { value: "5_plus_per_week" },
    });

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "New Name",
          alias: "new-alias",
          bio: "Updated bio",
          weight: 82.5,
          weightUnit: "lb",
          fitnessLevel: "advanced",
          trainingFrequency: "5_plus_per_week",
        }),
      ),
    );
  });

  it("shows error when save fails", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    getCurrentUser.mockResolvedValue({ displayName: "Alex", profile: {} });
    updateProfile.mockRejectedValue(new Error("Save failed"));

    render(<ProfileForm />);

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(await screen.findByText("settings.profile.saveError")).toBeInTheDocument();
  });

  it("hydrates flattened profile fields and clears weight", async () => {
    const { ProfileForm } = await import("../../src/components/profile/ProfileForm");
    getCurrentUser.mockResolvedValue({
      displayName: "Alex",
      bio: "Runner",
      alias: "alex",
      weight: 70,
      weightUnit: "lb",
      fitnessLevel: "elite",
      trainingFrequency: "rarely",
    });
    updateProfile.mockResolvedValue(undefined);

    render(<ProfileForm />);

    expect(await screen.findByLabelText("settings.profile.displayName")).toHaveValue("Alex");
    expect(screen.getByLabelText("settings.profile.bio")).toHaveValue("Runner");
    expect(screen.getByLabelText("settings.profile.alias")).toHaveValue("alex");
    expect(screen.getByLabelText("settings.profile.weight")).toHaveValue(70);
    expect(screen.getByLabelText("settings.profile.weightUnit")).toHaveValue("lb");
    expect(screen.getByLabelText("settings.profile.fitnessLevel")).toHaveValue("elite");
    expect(screen.getByLabelText("settings.profile.trainingFrequency")).toHaveValue("rarely");

    fireEvent.change(screen.getByLabelText("settings.profile.weight"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          weight: undefined,
          weightUnit: "lb",
          fitnessLevel: "elite",
        }),
      ),
    );
  });
});
