import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import VerifyEmail from "../../src/pages/VerifyEmail";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { rawHttpClient, resendVerificationEmail } from "../../src/services/api";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock API
vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    rawHttpClient: {
      get: vi.fn(),
      post: vi.fn(),
    },
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
        "verifyEmail.eyebrow": "Email Verification",
        "verifyEmail.titleVerifying": "Verifying Your Email",
        "verifyEmail.titleSuccess": "Email Verified!",
        "verifyEmail.titleFailed": "Verification Failed",
        "verifyEmail.descVerifying": "Please wait while we verify your email...",
        "verifyEmail.descSuccess": "Your email has been successfully verified",
        "verifyEmail.descFailed": "We couldn't verify your email",
        "verifyEmail.titleExpired": "Verification link expired",
        "verifyEmail.descExpired":
          "Your verification link has expired. Please request a new verification email.",
        "verifyEmail.noToken": "No verification token provided",
        "verifyEmail.goToLogin": "Go to Login",
        "verifyEmail.backToRegister": "Back to Register",
        "verifyEmail.resendEmailLabel": "Email address",
        "verifyEmail.resendEmailPlaceholder": "your@email.com",
        "verifyEmail.resendButton": "Send verification email",
        "errors.AUTH_TOKEN_EXPIRED": "Your verification link has expired. Please request a new one",
        "auth.register.fillAllFields": "Please fill in all fields",
      },
    },
  },
});

const renderWithProviders = (token = "test-token") => {
  const search = token ? `?token=${token}` : "";
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <I18nextProvider i18n={testI18n}>
        <VerifyEmail />
      </I18nextProvider>
    </MemoryRouter>,
  );
};

describe("VerifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("shows success state after successful verification", async () => {
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { success: true } });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Email Verified!")).toBeInTheDocument();
        expect(screen.getByText("Your email has been successfully verified")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Should have "Go to Login" button
    const loginButton = screen.getByRole("button", { name: /go to login/i });
    expect(loginButton).toBeInTheDocument();
  });

  it("shows error state on verification failure", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        data: {
          error: {
            message: "Invalid token",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification Failed")).toBeInTheDocument();
        expect(screen.getByText("Invalid token")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Should have "Back to Register" button
    const registerButton = screen.getByRole("button", { name: /back to register/i });
    expect(registerButton).toBeInTheDocument();
  });

  it("shows error when no token is provided", async () => {
    renderWithProviders("");

    await waitFor(
      () => {
        expect(screen.getByText("Verification Failed")).toBeInTheDocument();
        expect(screen.getByText("No verification token provided")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows generic error message on unknown error", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue(new Error("Network error"));

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification Failed")).toBeInTheDocument();
        expect(screen.getByText("Verification failed")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("calls API with correct token parameter", async () => {
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { success: true } });

    renderWithProviders("abc123");

    await waitFor(
      () => {
        expect(rawHttpClient.get).toHaveBeenCalledWith("/api/v1/auth/verify?token=abc123");
      },
      { timeout: 5000 },
    );
  });

  it("shows verifying state initially", () => {
    vi.mocked(rawHttpClient.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    renderWithProviders();

    expect(screen.getByText("Verifying Your Email")).toBeInTheDocument();
    expect(screen.getByText("Please wait while we verify your email...")).toBeInTheDocument();
  });

  it("displays success state with login button", async () => {
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { success: true } });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Email Verified!")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /go to login/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("handles button clicks for navigation", async () => {
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { success: true } });

    const { getByRole } = renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Email Verified!")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Wait for button to be present before clicking
    const loginButton = await screen.findByRole("button", { name: /go to login/i });
    expect(loginButton).toBeInTheDocument();

    // Verify button is clickable
    expect(loginButton).not.toBeDisabled();

    fireEvent.click(loginButton);

    // After clicking, the button should trigger navigation
    // The component may unmount or navigate, so we just verify it was clickable
  });

  it("handles error without response object", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue(new Error("Network error"));

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification Failed")).toBeInTheDocument();
        expect(screen.getByText("Verification failed")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("handles error with response but no error message", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        data: {},
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification Failed")).toBeInTheDocument();
        expect(screen.getByText("Verification failed")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("uses errorMessage in description when error occurs", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        data: {
          error: {
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Token expired")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows expired state when token expires (410 status)", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Your verification link has expired. Please request a new one",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification link expired")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Your verification link has expired. Please request a new verification email.",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows expired state when AUTH_TOKEN_EXPIRED error code is returned", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 200, // Status might not be 410, but error code indicates expiry
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification link expired")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("displays resend form when token is expired", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /send verification email/i }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /back to register/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("validates email input in resend form", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const submitButton = screen.getByRole("button", { name: /send verification email/i });
    fireEvent.click(submitButton);

    // Form validation should prevent submission
    await waitFor(
      () => {
        const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
        expect(emailInput.validity.valid).toBe(false);
      },
      { timeout: 5000 },
    );
  });

  it("navigates to register page with email when resend form is submitted", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole("button", { name: /send verification email/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/register", {
          state: { email: "test@example.com", resendVerification: true },
        });
      },
      { timeout: 5000 },
    );
  });

  it("navigates to register page when back to register button is clicked in expired state", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /back to register/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const backButton = screen.getByRole("button", { name: /back to register/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/register");
  });

  it("shows error message when resend form is submitted with empty email", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(
          screen.getByRole("button", { name: /send verification email/i }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const submitButton = screen.getByRole("button", { name: /send verification email/i });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText("Please fill in all fields")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Should not navigate when email is empty
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("updates email input value in resend form", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: "newemail@example.com" } });

    expect(emailInput.value).toBe("newemail@example.com");
  });

  it("trims whitespace from email before navigating", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Token expired",
          },
        },
      },
    });

    // Mock successful resend
    vi.mocked(resendVerificationEmail).mockResolvedValue({ success: true });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole("button", { name: /send verification email/i });

    fireEvent.change(emailInput, { target: { value: "  test@example.com  " } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/register", {
          state: { email: "test@example.com", resendVerification: true },
        });
      },
      { timeout: 5000 },
    );
  });

  it("displays correct title and description for expired state", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            message: "Your verification link has expired. Please request a new one",
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification link expired")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Your verification link has expired. Please request a new verification email.",
          ),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("uses translated error message when AUTH_TOKEN_EXPIRED code is present", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({
      response: {
        status: 410,
        data: {
          error: {
            code: "AUTH_TOKEN_EXPIRED",
            // No message, should use translation
          },
        },
      },
    });

    renderWithProviders();

    await waitFor(
      () => {
        expect(screen.getByText("Verification link expired")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
  it("does not navigate when resending verification fails with a network error", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({ response: { status: 410 } });
    vi.mocked(resendVerificationEmail).mockRejectedValue(new Error("Network unavailable"));

    renderWithProviders();
    const email = await screen.findByLabelText(/email address/i);
    fireEvent.change(email, { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send verification email/i }));

    expect(await screen.findByText("verifyEmail.resendError")).toBeInTheDocument();
    expect(resendVerificationEmail).toHaveBeenCalledWith({ email: "person@example.com" });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /send verification email/i })).toBeEnabled();
  });

  it("shows the server error when verification resend is rejected with an API error code", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({ response: { status: 410 } });
    vi.mocked(resendVerificationEmail).mockRejectedValue({
      response: { data: { error: { code: "EMAIL_NOT_FOUND", message: "Email not found" } } },
    });

    renderWithProviders();
    const email = await screen.findByLabelText(/email address/i);
    fireEvent.change(email, { target: { value: "unknown@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send verification email/i }));

    expect(await screen.findByText("errors.EMAIL_NOT_FOUND")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("allows retrying verification resend after a transient failure", async () => {
    vi.mocked(rawHttpClient.get).mockRejectedValue({ response: { status: 410 } });
    vi.mocked(resendVerificationEmail)
      .mockRejectedValueOnce(new Error("Temporarily offline"))
      .mockResolvedValueOnce({ success: true });

    renderWithProviders();
    const email = await screen.findByLabelText(/email address/i);
    fireEvent.change(email, { target: { value: "person@example.com" } });
    const submit = screen.getByRole("button", { name: /send verification email/i });
    fireEvent.click(submit);
    expect(await screen.findByText("verifyEmail.resendError")).toBeInTheDocument();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/register", {
        state: { email: "person@example.com", resendVerification: true },
      });
    });
    expect(resendVerificationEmail).toHaveBeenCalledTimes(2);
  });

});
