import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Profile from "../../src/pages/Profile";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "profile.eyebrow": "Your Profile",
        "profile.title": "Profile Settings",
        "profile.description": "Manage your profile and preferences",
        "profile.sections.visibility.title": "Privacy & Visibility",
        "profile.sections.visibility.description": "Control who can see your workouts",
        "profile.sections.units.title": "Units & Preferences",
        "profile.sections.units.description": "Choose metric or imperial",
        "profile.sections.achievements.title": "Achievements",
        "profile.sections.achievements.description": "Track your fitness milestones",
        "profile.edit": "Edit Profile",
      },
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
};

describe("Profile", () => {
  it("renders profile page with title and description", () => {
    renderWithProviders(<Profile />);

    expect(screen.getByText("Your Profile")).toBeInTheDocument();
    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Manage your profile and preferences")).toBeInTheDocument();
  });

  it("displays all profile sections", () => {
    renderWithProviders(<Profile />);

    // Visibility section
    expect(screen.getByText("Privacy & Visibility")).toBeInTheDocument();
    expect(screen.getByText("Control who can see your workouts")).toBeInTheDocument();

    // Units section
    expect(screen.getByText("Units & Preferences")).toBeInTheDocument();
    expect(screen.getByText("Choose metric or imperial")).toBeInTheDocument();

    // Achievements section
    expect(screen.getByText("Achievements")).toBeInTheDocument();
    expect(screen.getByText("Track your fitness milestones")).toBeInTheDocument();
  });

  it("renders edit button", () => {
    renderWithProviders(<Profile />);

    const editButton = screen.getByRole("button", { name: /edit profile/i });
    expect(editButton).toBeInTheDocument();
  });
});
