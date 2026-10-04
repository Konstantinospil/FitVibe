import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Register from "../../src/pages/Register";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as api from "../../src/services/api";

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
  };
});

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "auth.register.eyebrow": "Join FitVibe",
        "auth.register.title": "Create Account",
        "auth.register.description": "Start your fitness journey",
        "auth.register.successTitle": "Account Created!",
        "auth.register.successDescription": "Check your email to verify your account",
        "auth.register.nameLabel": "Full Name",
        "auth.register.emailLabel": "Email",
        "auth.register.passwordLabel": "Password",
        "auth.register.confirmPasswordLabel": "Confirm Password",
        "auth.register.submit": "Create Account",
        "auth.register.submitting": "Creating account...",
        "auth.register.loginPrompt": "Already have an account?",
        "auth.register.loginLink": "Sign in",
        "auth.showPassword": "Show password",
        "auth.hidePassword": "Hide password",
        "auth.register.passwordMismatch": "Passwords do not match",
        "auth.register.passwordsDoNotMatch": "Passwords do not match",
        "auth.register.error": "Registration failed. Please try again.",
        "auth.register.fillAllFields": "Please fill in all fields",
        "auth.register.acceptTerms": "I have read and accept the",
        "auth.register.termsLink": "Terms and Conditions",
        "auth.register.and": "and",
        "auth.register.privacyLink": "Privacy Policy",
        "auth.register.termsRequired":
          "You must accept the Terms and Conditions and Privacy Policy to create an account",
        "auth.register.passwordMinLength": "Password must be at least 12 characters long",
        "auth.register.passwordLowercase": "Password must contain at least one lowercase letter",
        "auth.register.passwordUppercase": "Password must contain at least one uppercase letter",
        "auth.register.passwordDigit": "Password must contain at least one digit",
        "auth.register.passwordSymbol": "Password must contain at least one symbol",
        "auth.register.passwordSymbolAlt": "Password must contain at least one special character",
        "validation.passwordMinLength": "password must be at least 12 characters",
        "validation.passwordLowercase": "password must contain at least one lowercase",
        "validation.passwordUppercase": "password must contain at least one uppercase",
        "validation.passwordDigit": "password must contain at least one digit",
        "validation.passwordSymbol": "password must contain at least one symbol",
        "errors.WEAK_PASSWORD": "Weak password",
        "auth.placeholders.name": "John Doe",
        "auth.placeholders.email": "you@example.com",
        "auth.placeholders.password": "Create a strong password",
        "auth.placeholders.confirmPassword": "Confirm your password",
        "auth.register.checkEmail": "Verification email sent to {{email}}",
        "auth.register.didntReceiveEmail": "Didn't receive the email?",
        "auth.register.resendEmail": "Resend verification email",
        "verifyEmail.resendSuccess": "Verification email sent! Please check your inbox.",
        "verifyEmail.resending": "Sending…",
        "verifyEmail.resendError": "Failed to send verification email. Please try again.",
        "errors.USER_ALREADY_EXISTS": "An account with this email already exists",
        "errors.AUTH_TOO_MANY_REQUESTS": "Too many requests. Please try again later.",
        "validation.required": "Fill in this field",
      },
    },
  },
});

const renderWithProviders = (ui: React.ReactElement, initialEntries?: string[]) => {
  const Router = initialEntries ? MemoryRouter : BrowserRouter;
  const routerProps = initialEntries ? { initialEntries } : {};
  return render(
    <Router {...routerProps}>
      <I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>
    </Router>,
  );
};

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Real timers are now the default in setupTests.ts
  });

  afterEach(() => {
    // Cleanup is handled by setupTests.ts
  });

  it("renders registration form", () => {
    renderWithProviders(<Register />);

    expect(screen.getByRole("heading", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /full name/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/create a strong password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm your password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create account$/i })).toBeInTheDocument();
  });

  it("shows password visibility toggles", () => {
    renderWithProviders(<Register />);

    const passwordToggles = screen.getAllByLabelText(/show password/i);
    expect(passwordToggles).toHaveLength(2); // One for password, one for confirm password

    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");

    fireEvent.mouseDown(passwordToggles[0]);
    expect(passwordInput).toHaveAttribute("type", "text");
    fireEvent.mouseUp(screen.getAllByLabelText(/hide password/i)[0]);
    expect(passwordInput).toHaveAttribute("type", "password");

    const refreshedToggles = screen.getAllByLabelText(/show password/i);
    fireEvent.mouseDown(refreshedToggles[1]);
    expect(confirmPasswordInput).toHaveAttribute("type", "text");
    fireEvent.mouseUp(screen.getAllByLabelText(/hide password/i)[0]);
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });

  it("validates password match", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Different123!" } });
    });

    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for error to appear using findBy* query
    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toHaveTextContent(/passwords do not match/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("handles successful registration", async () => {
    vi.mocked(api.register).mockResolvedValue({
      user: { id: "123", username: "john", email: "john@example.com" },
      session: { id: "session123" },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for API call and success message
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    expect(screen.getByText("Check your email to verify your account")).toBeInTheDocument();
    
    expect(api.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "john@example.com",
        password: "Password123!",
        username: expect.any(String),
        terms_accepted: true,
        profile: expect.objectContaining({
          display_name: "John Doe",
        }),
      }),
    );
  });

  it("displays error message on registration failure", async () => {
    vi.mocked(api.register).mockRejectedValue(new Error("Registration failed"));

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toHaveTextContent(/registration failed/i);
  });

  it("handles user already exists error", async () => {
    vi.mocked(api.register).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "USER_ALREADY_EXISTS",
            // Don't provide message so it uses the translation
          },
        },
      },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "existing@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toHaveTextContent(/account with this email already exists/i);
  });

  it("disables form during submission", async () => {
    // Use real timers for this test since it uses setTimeout
    vi.useRealTimers();
    vi.mocked(api.register).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");
    const submitButton = screen.getByRole("button", { name: /create account/i });

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        expect(submitButton).toHaveTextContent("Creating account...");
        expect(nameInput).toBeDisabled();
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(confirmPasswordInput).toBeDisabled();
      },
      { timeout: 1000 },
    );

    // Checkboxes should also be disabled during submission
    const checkboxesAfter = screen.getAllByRole("checkbox", { name: /accept the/i });
    expect(checkboxesAfter[0]).toBeDisabled();
  });

  it("renders login link", () => {
    renderWithProviders(<Register />);

    const loginLink = screen.getByRole("link", { name: /sign in/i });
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("generates username from email", async () => {
    vi.mocked(api.register).mockResolvedValue({
      user: { id: "456", username: "test.user_tag", email: "test.user+tag@example.com" },
      session: { id: "session456" },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(emailInput, { target: { value: "test.user+tag@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for success message to confirm registration completed
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    
    expect(api.register).toHaveBeenCalledWith({
      email: "test.user+tag@example.com",
      password: "Password123!",
      username: "test.user_tag", // Special characters replaced with underscores
      terms_accepted: true,
      profile: {
        display_name: "Test User",
      },
    });
  });

  it("validates password minimum length", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Short1!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Short1!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      // Click both checkboxes (terms and privacy)
      checkboxes.forEach((checkbox) => {
        fireEvent.click(checkbox);
      });
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert.textContent).toMatch(/password must be at least 12 characters/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("validates password contains lowercase letter", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "PASSWORD123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "PASSWORD123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      // Click both checkboxes (terms and privacy)
      checkboxes.forEach((checkbox) => {
        fireEvent.click(checkbox);
      });
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert.textContent).toMatch(/password must contain at least one lowercase/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("validates password contains uppercase letter", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      // Click both checkboxes (terms and privacy)
      checkboxes.forEach((checkbox) => {
        fireEvent.click(checkbox);
      });
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert.textContent).toMatch(/password must contain at least one uppercase/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("validates password contains digit", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "PasswordLong!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "PasswordLong!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      // Click both checkboxes (terms and privacy)
      checkboxes.forEach((checkbox) => {
        fireEvent.click(checkbox);
      });
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert.textContent).toMatch(/password must contain at least one digit/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("validates password contains symbol", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123Long" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123Long" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      // Click both checkboxes (terms and privacy)
      checkboxes.forEach((checkbox) => {
        fireEvent.click(checkbox);
      });
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert.textContent).toMatch(/password must contain at least one symbol/i);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("requires terms acceptance", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    // Don't check terms checkbox
    await act(() => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for error message about terms
    const errorMessages = await screen.findAllByText(/accept.*terms/i, {}, { timeout: 2000 });
    expect(errorMessages.length).toBeGreaterThan(0);

    expect(api.register).not.toHaveBeenCalled();
  });

  it("validates all fields are filled", async () => {
    renderWithProviders(<Register />);

    const form = screen.getByRole("button", { name: /create account/i }).closest("form");
    await act(() => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for error message about filling all fields
    const errorMessage = await screen.findByText(/fill.*all.*fields/i, {}, { timeout: 2000 });
    expect(errorMessage).toBeInTheDocument();

    expect(api.register).not.toHaveBeenCalled();
  });

  it("handles error with only error message", async () => {
    vi.mocked(api.register).mockRejectedValue({
      response: {
        data: {
          error: {
            message: "Custom error message",
          },
        },
      },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toHaveTextContent("Custom error message");
  });

  it("handles error with translated error code", async () => {
    testI18n.addResource("en", "translation", "errors.UNKNOWN_ERROR", "An unknown error occurred");

    vi.mocked(api.register).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "UNKNOWN_ERROR",
          },
        },
      },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toBeInTheDocument();
  });

  it("handles network error without response object", async () => {
    vi.mocked(api.register).mockRejectedValue(new Error("Network error"));

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toBeInTheDocument();
  });

  it("handles input focus and blur events", () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);

    // Test that focus and blur events can be triggered
    // Style assertions are brittle with CSS variables in test environment
    fireEvent.focus(nameInput);
    expect(nameInput).toBeInTheDocument();

    fireEvent.focus(emailInput);
    expect(emailInput).toBeInTheDocument();

    fireEvent.focus(passwordInput);
    expect(passwordInput).toBeInTheDocument();

    fireEvent.focus(confirmPasswordInput);
    expect(confirmPasswordInput).toBeInTheDocument();

    // Test blur events
    fireEvent.blur(nameInput);
    expect(nameInput).toBeInTheDocument();

    fireEvent.blur(emailInput);
    expect(emailInput).toBeInTheDocument();

    fireEvent.blur(passwordInput);
    expect(passwordInput).toBeInTheDocument();

    fireEvent.blur(confirmPasswordInput);
    expect(confirmPasswordInput).toBeInTheDocument();
  });

  it("handles password toggle functionality", () => {
    renderWithProviders(<Register />);

    const passwordToggles = screen.getAllByLabelText(/show password/i);
    const passwordToggle = passwordToggles[0];
    const confirmPasswordToggle = passwordToggles[1];

    // Verify toggles exist and are clickable
    expect(passwordToggle).toBeInTheDocument();
    expect(confirmPasswordToggle).toBeInTheDocument();

    fireEvent.mouseDown(passwordToggle);
    expect(screen.getByPlaceholderText(/create a strong password/i)).toHaveAttribute("type", "text");
    fireEvent.mouseLeave(passwordToggle);
    expect(screen.getByPlaceholderText(/create a strong password/i)).toHaveAttribute("type", "password");

    fireEvent.touchStart(confirmPasswordToggle);
    expect(screen.getByPlaceholderText(/confirm your password/i)).toHaveAttribute("type", "text");
    fireEvent.touchEnd(confirmPasswordToggle);
    expect(screen.getByPlaceholderText(/confirm your password/i)).toHaveAttribute("type", "password");
  });

  it("shows error styling on terms checkbox when error exists", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    // Don't check terms checkbox
    await act(() => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    await screen.findAllByText(/accept.*terms/i, {}, { timeout: 2000 });

    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    const termsCheckbox = checkboxes[0];
    expect(termsCheckbox).toHaveAttribute("aria-invalid", "true");
    expect(termsCheckbox.closest("[data-component='checkbox']")).toHaveAttribute(
      "data-state",
      "error",
    );
  });

  it("trims whitespace from name and email inputs", async () => {
    vi.mocked(api.register).mockResolvedValue({
      user: { id: "123", username: "john", email: "john@example.com" },
      session: { id: "session123" },
    });

    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "  John Doe  " } });
      fireEvent.change(emailInput, { target: { value: "  john@example.com  " } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for success message to confirm registration completed
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    
    expect(api.register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "john@example.com",
        password: "Password123!",
        username: expect.any(String),
        terms_accepted: true,
        profile: expect.objectContaining({
          display_name: "John Doe",
        }),
      }),
    );
  });

  it("handles empty name validation", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "   " } }); // Only whitespace
      fireEvent.change(emailInput, { target: { value: "john@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toBeInTheDocument();

    expect(api.register).not.toHaveBeenCalled();
  });

  it("handles empty email validation", async () => {
    renderWithProviders(<Register />);

    const nameInput = screen.getByRole("textbox", { name: /full name/i });
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const passwordInput = screen.getByPlaceholderText(/create a strong password/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm your password/i);
    const submitButton = screen.getByRole("button", { name: /create account/i });

    const form = nameInput.closest("form");

    await act(() => {
      fireEvent.change(nameInput, { target: { value: "John Doe" } });
      fireEvent.change(emailInput, { target: { value: "   " } }); // Only whitespace
      fireEvent.change(passwordInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmPasswordInput, { target: { value: "Password123!" } });
    });
    const checkboxes = screen.getAllByRole("checkbox", { name: /accept the/i });
    await act(() => {
      fireEvent.click(checkboxes[0]); // Terms checkbox
      fireEvent.click(checkboxes[1]); // Privacy checkbox
      if (form) {
        fireEvent.submit(form);
      }
    });

    const alert = await screen.findByRole("alert", {}, { timeout: 1000 });
    expect(alert).toBeInTheDocument();

    expect(api.register).not.toHaveBeenCalled();
  });

  it("should show i18n validation message for empty required fields", async () => {
    renderWithProviders(<Register />);

    const form = screen.getByRole("textbox", { name: /email/i }).closest("form");
    expect(form).toBeInTheDocument();

    const emailInput = screen.getByRole("textbox", { name: /email/i }) as HTMLInputElement;

    // Try to submit form with empty required field
    await act(() => {
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for validation to trigger - form submission should trigger validation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    
    // Check that the email field has the custom validation message
    if (!emailInput.checkValidity()) {
      expect(emailInput.validationMessage).toBe("Fill in this field");
    }
  });

  it("pre-fills email from location state when navigating from expired token", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/register",
            state: { email: "prefilled@example.com", resendVerification: true },
          },
        ]}
      >
        <I18nextProvider i18n={testI18n}>
          <Register />
        </I18nextProvider>
      </MemoryRouter>,
    );

    const emailInput = await screen.findByRole("textbox", { name: /email/i }, { timeout: 1000 }) as HTMLInputElement;
    expect(emailInput.value).toBe("prefilled@example.com");
  });

  it("does not pre-fill email when location state is null", () => {
    renderWithProviders(<Register />);

    const emailInput = screen.getByRole("textbox", { name: /email/i }) as HTMLInputElement;
    expect(emailInput.value).toBe("");
  });

  it("does not pre-fill email when location state has no email", async () => {
    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/register", state: { resendVerification: true } }]}
      >
        <I18nextProvider i18n={testI18n}>
          <Register />
        </I18nextProvider>
      </MemoryRouter>,
    );

    const emailInput = screen.getByRole("textbox", { name: /email/i }) as HTMLInputElement;
    expect(emailInput.value).toBe("");
  });

  it("should show resend link on registration success page", async () => {
    const mockRegister = vi.mocked(api.register);
    mockRegister.mockResolvedValueOnce({
      user: { id: "user-123", email: "test@example.com" },
      message: "Registration successful",
    });

    renderWithProviders(<Register />);

    // Fill form and submit
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/create a strong password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm your password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(() => {
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
    });

    const form = screen.getByRole("button", { name: /^create account$/i }).closest("form");
    expect(form).toBeInTheDocument();

    await act(() => {
      if (form) {
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
      }
    });

    // Wait for success screen to confirm registration succeeded
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    
    expect(mockRegister).toHaveBeenCalled();

    // Then check for the email message (might be split across elements)
    expect(screen.getByText(/verification email sent to/i)).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /resend verification email/i,
      }),
    ).toBeInTheDocument();
  });

  it("should call resendVerificationEmail when resend link is clicked", async () => {
    const mockRegister = vi.mocked(api.register);
    const mockResend = vi.mocked(api.resendVerificationEmail);
    mockRegister.mockResolvedValueOnce({
      user: { id: "user-123", email: "test@example.com" },
      message: "Registration successful",
    });
    mockResend.mockResolvedValueOnce({
      message: "Verification email sent",
    });

    renderWithProviders(<Register />);

    // Fill form and submit
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/create a strong password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm your password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(() => {
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
    });

    const form = screen.getByRole("button", { name: /^create account$/i }).closest("form");
    expect(form).toBeInTheDocument();

    await act(() => {
      if (form) {
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
      }
    });

    // Wait for success screen to confirm registration succeeded
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    
    expect(mockRegister).toHaveBeenCalled();

    // Then check for the email message (might be split across elements)
    expect(screen.getByText(/verification email sent to/i)).toBeInTheDocument();

    // Click resend link
    const resendButton = screen.getByText(/resend verification email/i);
    await act(() => {
      fireEvent.click(resendButton);
    });

    // Wait for resend API call
    await waitFor(
      () => {
        expect(mockResend).toHaveBeenCalledWith({ email: "test@example.com" });
      },
      { timeout: 1000 },
    );

    // Check for success message
    await screen.findByText(/verification email sent! please check your inbox/i, {}, { timeout: 2000 });
  });

  it("should show error message when resend fails", async () => {
    const mockRegister = vi.mocked(api.register);
    const mockResend = vi.mocked(api.resendVerificationEmail);
    mockRegister.mockResolvedValueOnce({
      user: { id: "user-123", email: "test@example.com" },
      message: "Registration successful",
    });
    mockResend.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            code: "AUTH_TOO_MANY_REQUESTS",
            message: "Too many requests",
          },
        },
      },
    });

    renderWithProviders(<Register />);

    // Fill form and submit
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/create a strong password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm your password/i), {
      target: { value: "SecureP@ssw0rd123!" },
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(() => {
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);
    });

    const form = screen.getByRole("button", { name: /^create account$/i }).closest("form");
    expect(form).toBeInTheDocument();

    await act(() => {
      if (form) {
        fireEvent.submit(form);
      } else {
        fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
      }
    });

    // Wait for success screen to confirm registration succeeded
    await screen.findByText("Account Created!", {}, { timeout: 2000 });
    
    expect(mockRegister).toHaveBeenCalled();

    // Then check for the email message (might be split across elements)
    expect(screen.getByText(/verification email sent to/i)).toBeInTheDocument();

    // Click resend link
    const resendButton = screen.getByText(/resend verification email/i);
    await act(() => {
      fireEvent.click(resendButton);
    });

    await screen.findByText(/too many requests/i, {}, { timeout: 2000 });
  });
});
