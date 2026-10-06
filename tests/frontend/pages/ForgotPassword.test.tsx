import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ForgotPassword from "../../src/pages/ForgotPassword";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as api from "../../src/services/api";

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    forgotPassword: vi.fn(),
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
        "auth.forgotPassword.eyebrow": "Password Reset",
        "auth.forgotPassword.title": "Forgot Password",
        "auth.forgotPassword.description": "Enter your email to reset your password",
        "auth.forgotPassword.titleSuccess": "Check Your Email",
        "auth.forgotPassword.descSuccess": "We've sent you a password reset link",
        "auth.forgotPassword.successMessage": "Password reset link sent to your email",
        "auth.forgotPassword.emailLabel": "Email",
        "auth.forgotPassword.emailPlaceholder": "you@example.com",
        "auth.forgotPassword.sendLink": "Send Reset Link",
        "auth.forgotPassword.sending": "Sending...",
        "auth.forgotPassword.backToLogin": "Back to Login",
        "auth.forgotPassword.errorSend": "Failed to send reset link",
      },
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>
    </BrowserRouter>,
  );
};

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders forgot password form", () => {
    renderWithProviders(<ForgotPassword />);

    expect(screen.getByText("Forgot Password")).toBeInTheDocument();
    expect(screen.getByText("Enter your email to reset your password")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("renders back to login link", () => {
    renderWithProviders(<ForgotPassword />);

    const loginLink = screen.getByRole("link", { name: /back to login/i });
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("handles successful password reset request", async () => {
    vi.mocked(api.forgotPassword).mockResolvedValue({} as any);

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const form = emailInput.closest("form");

    await act(() => {
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      if (form) {
        fireEvent.submit(form);
      }
    });

    // Wait for success screen - the component should re-render with success state
    await waitFor(
      () => {
        expect(screen.getByText("Check Your Email")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(api.forgotPassword).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(screen.getByText("Password reset link sent to your email")).toBeInTheDocument();
  });

  it("displays error message on failure", async () => {
    vi.mocked(api.forgotPassword).mockRejectedValue(new Error("Failed to send"));

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const form = emailInput.closest("form");

    await act(() => {
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      if (form) {
        fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        const alert = screen.queryByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/failed to send/i);
      },
      { timeout: 3000 },
    );
  });

  it("displays custom error message from API", async () => {
    vi.mocked(api.forgotPassword).mockRejectedValue({
      response: {
        data: {
          error: {
            message: "Email not found",
          },
        },
      },
    });

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const form = emailInput.closest("form");

    await act(() => {
      fireEvent.change(emailInput, { target: { value: "notfound@example.com" } });
      if (form) {
        fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        const alert = screen.queryByRole("alert");
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent("Email not found");
      },
      { timeout: 1000 },
    );
  });

  it("disables form during submission", async () => {
    vi.mocked(api.forgotPassword).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const form = emailInput.closest("form");
    const submitButton = screen.getByRole("button", { name: /send reset link/i });

    await act(() => {
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      if (form) {
        fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        expect(submitButton).toHaveTextContent("Sending...");
        expect(emailInput).toBeDisabled();
      },
      { timeout: 1000 },
    );
  });

  it("shows back to login link on success screen", async () => {
    vi.mocked(api.forgotPassword).mockResolvedValue({} as any);

    renderWithProviders(<ForgotPassword />);

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const form = emailInput.closest("form");

    await act(() => {
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      if (form) {
        fireEvent.submit(form);
      }
    });

    await waitFor(
      () => {
        expect(screen.getByText("Check Your Email")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const loginLink = screen.getByRole("link", { name: /back to login/i });
    expect(loginLink).toHaveAttribute("href", "/login");
  });
});
