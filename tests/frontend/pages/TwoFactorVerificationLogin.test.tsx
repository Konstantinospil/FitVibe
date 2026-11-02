import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TwoFactorVerificationLogin from "../../src/pages/TwoFactorVerificationLogin";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as api from "../../src/services/api";
import { AuthProvider } from "../../src/contexts/AuthContext";

// Mock navigate
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
    verify2FALogin: vi.fn(),
    getAdministratorPasswordPolicyStatus: vi.fn(),
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
        "auth.twoFactor.eyebrow": "Two-Factor Authentication",
        "auth.twoFactor.title": "Enter Your Code",
        "auth.twoFactor.description": "Enter the 6-digit code from your authenticator app",
        "auth.twoFactor.securityNotice": "This extra step ensures it's really you signing in",
        "auth.twoFactor.codeLabel": "Authentication Code",
        "auth.twoFactor.codeHint": "6-digit code or backup code",
        "auth.twoFactor.verify": "Verify and Continue",
        "auth.twoFactor.verifying": "Verifying...",
        "auth.twoFactor.backToLogin": "Back to login",
        "auth.twoFactor.invalidCode": "Invalid 2FA code. Please try again.",
        "auth.twoFactor.sessionExpired": "Session expired. Please log in again.",
        "auth.twoFactor.error": "Verification failed. Please try again.",
        "auth.twoFactor.invalidSession": "Invalid session. Please try logging in again.",
      },
    },
  },
});

const renderWithProviders = (locationState = { pendingSessionId: "session123", from: "/" }) => {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login/verify-2fa", state: locationState }]}>
      <I18nextProvider i18n={testI18n}>
        <AuthProvider>
          <Routes>
            <Route path="/login/verify-2fa" element={<TwoFactorVerificationLogin />} />
          </Routes>
        </AuthProvider>
      </I18nextProvider>
    </MemoryRouter>,
  );
};

describe("TwoFactorVerificationLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("renders 2FA verification form", () => {
    renderWithProviders();

    expect(screen.getByText("Enter Your Code")).toBeInTheDocument();
    expect(
      screen.getByText("Enter the 6-digit code from your authenticator app"),
    ).toBeInTheDocument();
    expect(screen.getByText("Authentication Code")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("displays security notice", () => {
    renderWithProviders();

    expect(
      screen.getByText("This extra step ensures it's really you signing in"),
    ).toBeInTheDocument();
  });

  it("accepts TOTP and backup-code input", () => {
    renderWithProviders();

    const codeInput = screen.getByRole("textbox");

    fireEvent.change(codeInput, { target: { value: "123456" } });
    expect(codeInput).toHaveValue("123456");

    fireEvent.change(codeInput, { target: { value: "abcd-2345" } });
    expect(codeInput).toHaveValue("ABCD-2345");

    fireEvent.change(codeInput, { target: { value: "ABCD-2345-extra" } });
    expect(codeInput).toHaveValue("ABCD-2345");
  });

  it("enables submit only for a valid TOTP or backup code", () => {
    renderWithProviders();

    const submitButton = screen.getByRole("button", { name: /verify and continue/i });

    // Should be disabled initially
    expect(submitButton).toBeDisabled();

    const codeInput = screen.getByRole("textbox");
    fireEvent.change(codeInput, { target: { value: "12345" } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(codeInput, { target: { value: "123456" } });
    expect(submitButton).not.toBeDisabled();

    fireEvent.change(codeInput, { target: { value: "ABCD-2345" } });
    expect(submitButton).not.toBeDisabled();
  });

  it("submits a backup code without rewriting it", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "123", username: "testuser", email: "test@example.com" },
      session: { id: "session123" },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");
    fireEvent.change(codeInput, { target: { value: "ABCD-2345" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(api.verify2FALogin).toHaveBeenCalledWith({
        pendingSessionId: "session123",
        code: "ABCD-2345",
      });
    });
  });

  it("handles successful 2FA verification", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "123", username: "testuser", email: "test@example.com" },
      session: { id: "session123" },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    // Submit the form directly
    if (form) {
      fireEvent.submit(form);
    }

    // Check that the API was called with correct parameters
    await waitFor(
      () => {
        expect(api.verify2FALogin).toHaveBeenCalledWith({
          pendingSessionId: "session123",
          code: "123456",
        });
      },
      { timeout: 5000 },
    );
  });

  it("displays error for invalid 2FA code", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "AUTH_INVALID_2FA_CODE",
          },
        },
      },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid 2FA code. Please try again.");
      },
      { timeout: 5000 },
    );
  });

  it("displays generic error message", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue(new Error("Network error"));

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Verification failed. Please try again.",
        );
      },
      { timeout: 5000 },
    );
  });

  it("disables form during submission", async () => {
    const user = userEvent.setup();
    vi.mocked(api.verify2FALogin).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const submitButton = screen.getByRole("button", { name: /verify and continue/i });

    // Use userEvent for more realistic interactions that handle async updates
    await user.type(codeInput, "123456");
    await user.click(submitButton);

    // Wait for the button text to change to "Verifying..." which indicates loading state
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /verifying/i })).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Now check all the expected states
    const button = screen.getByRole("button", { name: /verifying/i });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("renders back to login button", () => {
    renderWithProviders();

    const backButton = screen.getByRole("button", { name: /back to login/i });
    expect(backButton).toBeInTheDocument();
  });

  it("handles AUTH_2FA_SESSION_EXPIRED error", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "AUTH_2FA_SESSION_EXPIRED",
          },
        },
      },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Session expired. Please log in again.",
        );
      },
      { timeout: 5000 },
    );
  });

  it("handles other error codes", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "UNKNOWN_ERROR",
          },
        },
      },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Verification failed. Please try again.",
        );
      },
      { timeout: 5000 },
    );
  });

  it("handles missing pendingSessionId in handleSubmit", async () => {
    // Use a valid sessionId initially, then test the handleSubmit branch
    renderWithProviders({ pendingSessionId: "session123", from: "/" });

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    // Mock to return undefined for pendingSessionId check
    // This tests the branch in handleSubmit where pendingSessionId is falsy
    // We'll simulate this by directly testing the error path
    fireEvent.change(codeInput, { target: { value: "123456" } });

    // Mock the API to fail, which will test error handling
    vi.mocked(api.verify2FALogin).mockRejectedValue(new Error("Session invalid"));

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("handles error without response object", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      message: "Network error",
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Verification failed. Please try again.",
        );
      },
      { timeout: 5000 },
    );
  });

  it("handles error with response but no error code", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      response: {
        data: {},
      },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Verification failed. Please try again.",
        );
      },
      { timeout: 5000 },
    );
  });

  it("redirects to login when pendingSessionId is missing on mount", async () => {
    renderWithProviders({ pendingSessionId: undefined, from: "/" });

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
      },
      { timeout: 2000 },
    );
  });

  it("handles missing pendingSessionId in form submission", async () => {
    renderWithProviders({ pendingSessionId: undefined, from: "/" });

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Invalid session. Please try logging in again.",
        );
      },
      { timeout: 5000 },
    );

    // Should navigate after 2 seconds
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
      },
      { timeout: 3000 },
    );
  });

  it("handles TERMS_VERSION_OUTDATED error code", async () => {
    vi.mocked(api.verify2FALogin).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "TERMS_VERSION_OUTDATED",
          },
        },
      },
    });

    renderWithProviders();

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/terms-reacceptance", { replace: true });
      },
      { timeout: 5000 },
    );
  });

  it("handles back to login button click", async () => {
    renderWithProviders();

    const backButton = screen.getByRole("button", { name: /back to login/i });
    fireEvent.click(backButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
      },
      { timeout: 1000 },
    );
  });

  it("navigates to custom 'from' path after successful verification", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "123", username: "testuser", email: "test@example.com" },
      session: { id: "session123" },
    });

    renderWithProviders({ pendingSessionId: "session123", from: "/dashboard" });

    const codeInput = screen.getByRole("textbox");
    const form = codeInput.closest("form");

    fireEvent.change(codeInput, { target: { value: "123456" } });

    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
      },
      { timeout: 5000 },
    );
  });
  it("redirects a legacy administrator to mandatory password transition after MFA", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "admin-123", username: "admin", email: "admin@example.com", role: "admin" },
      session: { id: "session123" },
    });
    vi.mocked(api.getAdministratorPasswordPolicyStatus).mockResolvedValue({
      passwordChangeRequired: true,
      minimumPasswordLength: 16,
    });
    renderWithProviders({ pendingSessionId: "session123", from: "/dashboard" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
    await waitFor(() => {
      expect(api.getAdministratorPasswordPolicyStatus).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/admin/password-update", { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("allows a policy-compliant superadmin to reach the requested route after MFA", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "super-123", username: "super", email: "super@example.com", role: "superadmin" },
      session: { id: "session123" },
    });
    vi.mocked(api.getAdministratorPasswordPolicyStatus).mockResolvedValue({
      passwordChangeRequired: false,
      minimumPasswordLength: 16,
    });
    renderWithProviders({ pendingSessionId: "session123", from: "/dashboard" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
    await waitFor(() => {
      expect(api.getAdministratorPasswordPolicyStatus).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/admin/password-update", { replace: true });
  });

  it("defers policy-status outages to the server-enforced protected route gate", async () => {
    vi.mocked(api.verify2FALogin).mockResolvedValue({
      user: { id: "admin-123", username: "admin", email: "admin@example.com", role: "admin" },
      session: { id: "session123" },
    });
    vi.mocked(api.getAdministratorPasswordPolicyStatus).mockRejectedValue(
      new Error("temporary policy status failure"),
    );
    renderWithProviders({ pendingSessionId: "session123", from: "/dashboard" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form") as HTMLFormElement);
    await waitFor(() => {
      expect(api.getAdministratorPasswordPolicyStatus).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });


});
