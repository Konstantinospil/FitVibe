import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import CompleteRegistration from "../../src/pages/CompleteRegistration";
import * as api from "../../src/services/api";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    getRegistrationIntent: vi.fn(),
    getRegistrationOptions: vi.fn(),
    completeRegistration: vi.fn(),
  };
});

const TOKEN = "T".repeat(43);
const PASSWORD = "an original long passphrase";

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "auth.registerComplete.title": "Finish creating your account",
        "auth.registerComplete.description": "Set up your profile.",
        "auth.registerComplete.checking": "Checking your link…",
        "auth.registerComplete.emailHelp": "Confirmed by the link you followed.",
        "auth.registerComplete.invalidTitle": "This link can't be used",
        "auth.registerComplete.invalidDescription": "The link is invalid or already used.",
        "auth.registerComplete.expiredTitle": "This link has expired",
        "auth.registerComplete.expiredDescription": "Links are valid for a limited time.",
        "auth.registerComplete.restart": "Start again",
        "auth.registerComplete.successTitle": "Your account is ready",
        "auth.registerComplete.successDescription": "Sign in with your email and password.",
        "auth.registerComplete.signIn": "Sign in",
        "auth.register.emailLabel": "Email",
        "auth.register.nameLabel": "Full Name",
        "auth.register.weightLabel": "Weight (kg)",
        "auth.register.dateOfBirthLabel": "Date of birth",
        "auth.register.genderLabel": "Gender",
        "auth.register.activityIntensityLabel": "Current activity intensity",
        "auth.register.activityIntensityHelp": "Choose current training activity",
        "auth.register.selectPlaceholder": "Select an option",
        "auth.register.photoLabel": "Profile photo",
        "auth.register.photoHelp": "Optional profile photo",
        "auth.register.photoSelect": "Select photo",
        "auth.register.photoChange": "Change photo",
        "auth.register.avatarFallback": "Athlete",
        "auth.register.usernameLabel": "Username (optional)",
        "auth.register.usernameHelp": "3-50 characters",
        "auth.register.passwordLabel": "Password",
        "auth.register.confirmPasswordLabel": "Confirm Password",
        "auth.register.passwordMismatch": "Passwords do not match",
        "auth.register.submit": "Create account",
        "auth.register.submitting": "Creating account…",
        "auth.register.acceptTerms": "I have read and accept the",
        "auth.register.termsLink": "Terms and Conditions",
        "auth.register.privacyLink": "Privacy Policy",
        "auth.register.termsRequired": "You must accept the terms",
        "auth.register.fillAllFields": "Please fill in all fields",
        "auth.register.weightInvalidConfigured": "Weight must be between {{min}} and {{max}} kg.",
        "auth.register.error": "Registration failed.",
        "auth.placeholders.name": "John Doe",
        "auth.placeholders.username": "username",
        "auth.placeholders.password": "Create a strong password",
        "auth.placeholders.confirmPassword": "Confirm your password",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",
        "errors.USER_USERNAME_TAKEN": "Username already in use",
        "passwordStrength.advisory.PASSWORD_BREACHED": "This password appeared in a breach.",
        "validation.passwordMinLength": "password must be at least 12 characters",
        "validation.required": "Fill in this field",
      },
    },
  },
});

function renderPage(search = `?token=${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[`/register/complete${search}`]}>
      <I18nextProvider i18n={testI18n}>
        <CompleteRegistration />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

async function fillForm(overrides: { confirm?: string; weight?: string; terms?: boolean } = {}) {
  await screen.findByRole("option", { name: "Prefer not to say" });
  fireEvent.change(screen.getByRole("textbox", { name: /full name/i }), {
    target: { value: "Jamie Runner" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: /weight/i }), {
    target: { value: overrides.weight ?? "75" },
  });
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: "2000-01-15" } });
  fireEvent.change(screen.getByRole("combobox", { name: /^gender$/i }), {
    target: { value: "prefer_not_to_say" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: /current activity intensity/i }), {
    target: { value: "intermediate" },
  });
  fireEvent.change(screen.getByPlaceholderText(/create a strong password/i), {
    target: { value: PASSWORD },
  });
  fireEvent.change(screen.getByPlaceholderText(/confirm your password/i), {
    target: { value: overrides.confirm ?? PASSWORD },
  });
  if (overrides.terms !== false) {
    for (const checkbox of screen.getAllByRole("checkbox", { name: /accept the/i })) {
      fireEvent.click(checkbox);
    }
  }
}

function submit() {
  fireEvent.submit(
    screen.getByRole("textbox", { name: /full name/i }).closest("form") as HTMLFormElement,
  );
}

describe("CompleteRegistration (email-first step 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getRegistrationIntent).mockResolvedValue({
      email: "jamie.runner@example.com",
      expiresAt: "2026-11-25T12:00:00.000Z",
    });
    vi.mocked(api.getRegistrationOptions).mockResolvedValue({
      genders: [{ code: "prefer_not_to_say", description: "Prefer not to say" }],
      fitnessLevels: [{ code: "intermediate", description: "Trains 3-4 times per week" }],
      weight: { minKg: 20, maxKg: 400 },
    });
    vi.mocked(api.completeRegistration).mockResolvedValue({
      user: { id: "u1", username: "jamie.runner", email: "jamie.runner@example.com" },
    });
  });

  it("checks the link, then shows the address from it read-only and suggests a username", async () => {
    renderPage();
    expect(screen.getByText("Checking your link…", { selector: "*:not(p)" })).toBeInTheDocument();

    const email = await screen.findByRole("textbox", { name: /email/i });
    expect(api.getRegistrationIntent).toHaveBeenCalledWith(TOKEN);
    expect(email).toHaveValue("jamie.runner@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: /username/i })).toHaveValue("jamie.runner");
  });

  it("treats a missing token as an unusable link without calling the API", async () => {
    renderPage("");

    await screen.findByRole("heading", { name: "This link can't be used" });
    expect(api.getRegistrationIntent).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /start again/i })).toHaveAttribute("href", "/register");
  });

  it("explains an invalid or used link", async () => {
    vi.mocked(api.getRegistrationIntent).mockRejectedValue({
      response: { data: { error: { code: "AUTH_INVALID_TOKEN" } } },
    });
    renderPage();

    await screen.findByRole("heading", { name: "This link can't be used" });
  });

  it("explains an expired link", async () => {
    vi.mocked(api.getRegistrationIntent).mockRejectedValue({
      response: { data: { error: { code: "AUTH_TOKEN_EXPIRED" } } },
    });
    renderPage();

    await screen.findByRole("heading", { name: "This link has expired" });
    expect(screen.getByRole("link", { name: /start again/i })).toHaveAttribute("href", "/register");
  });

  it("creates the account with the link token and profile, then offers sign in", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    await fillForm();
    submit();

    await screen.findByRole("heading", { name: "Your account is ready" });
    expect(api.completeRegistration).toHaveBeenCalledWith({
      token: TOKEN,
      password: PASSWORD,
      username: "jamie.runner",
      terms_accepted: true,
      profile: {
        display_name: "Jamie Runner",
        weight_kg: 75,
        date_of_birth: "2000-01-15",
        sex: "prefer_not_to_say",
        fitness_level: "intermediate",
      },
    });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("uploads an optional profile photo with the completion", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    const photo = new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/select photo/i), { target: { files: [photo] } });
    await fillForm();
    submit();

    await screen.findByRole("heading", { name: "Your account is ready" });
    expect(api.completeRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ token: TOKEN }),
      photo,
    );
  });

  it("shows an advisory password warning after success", async () => {
    vi.mocked(api.completeRegistration).mockResolvedValue({
      user: { id: "u1", username: "jamie.runner", email: "jamie.runner@example.com" },
      passwordWarning: "PASSWORD_BREACHED",
    });
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    await fillForm();
    submit();

    await screen.findByText("This password appeared in a breach.");
  });

  it("reports a taken username and keeps the form", async () => {
    vi.mocked(api.completeRegistration).mockRejectedValue({
      response: { data: { error: { code: "USER_USERNAME_TAKEN" } } },
    });
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    await fillForm();
    submit();

    await screen.findByText("Username already in use");
    expect(screen.getByRole("textbox", { name: /username/i })).toBeInTheDocument();
  });

  it("switches to the expired screen if the link expires before submission", async () => {
    vi.mocked(api.completeRegistration).mockRejectedValue({
      response: { data: { error: { code: "AUTH_TOKEN_EXPIRED" } } },
    });
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    await fillForm();
    submit();

    await screen.findByRole("heading", { name: "This link has expired" });
  });

  it("validates matching passwords, accepted terms and the weight range before calling the API", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });

    await fillForm({ confirm: "a different long passphrase" });
    submit();
    await screen.findByText("Passwords do not match");

    fireEvent.change(screen.getByPlaceholderText(/confirm your password/i), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /weight/i }), {
      target: { value: "5" },
    });
    submit();
    await screen.findByText("Weight must be between 20 and 400 kg.");

    expect(api.completeRegistration).not.toHaveBeenCalled();
  });

  it("requires the terms and privacy policy", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    await fillForm({ terms: false });
    submit();

    await waitFor(() =>
      expect(screen.getAllByText("You must accept the terms").length).toBeGreaterThan(0),
    );
    expect(api.completeRegistration).not.toHaveBeenCalled();
  });

  it("requires the profile fields", async () => {
    renderPage();
    await screen.findByRole("textbox", { name: /email/i });
    submit();

    await screen.findByText("Please fill in all fields");
    expect(api.completeRegistration).not.toHaveBeenCalled();
  });
});
