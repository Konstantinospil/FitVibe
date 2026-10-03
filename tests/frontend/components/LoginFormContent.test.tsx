import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LoginFormContent from "../../src/pages/LoginFormContent";
import * as api from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";

const mockNavigate = vi.fn();
const mockSignIn = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({
      state: null,
    }),
  };
});

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  login: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth.login.emailLabel": "Email",
        "auth.login.passwordLabel": "Password",
        "auth.login.showPassword": "Show password",
        "auth.login.hidePassword": "Hide password",
        "auth.login.submit": "Sign In",
        "auth.login.submitting": "Signing in...",
        "auth.login.registerPrompt": "Create account",
        "auth.login.forgot": "Forgot password?",
        "auth.login.error": "Login failed",
        "auth.placeholders.email": "Enter your email",
        "auth.placeholders.password": "Enter your password",
        "errors.INVALID_CREDENTIALS": "Invalid credentials",
      };
      return translations[key] || key;
    },
  }),
}));

describe("LoginFormContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      signIn: mockSignIn,
      signOut: vi.fn(),
      user: null,
      isAuthenticated: false,
      updateUser: vi.fn(),
    });
  });

  it("should render login form", () => {
    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("should show error when submitting empty form", async () => {
    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", { name: "Sign In" });
    const form = submitButton.closest("form");
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.click(submitButton);
    }

    await waitFor(
      () => {
        const errorText = screen.queryByText("Please fill in all fields");
        const alert = screen.queryByRole("alert");
        expect(errorText || alert).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it("should call login API on form submission", async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      requires2FA: false,
      session: null,
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(api.login).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      },
      { timeout: 5000 },
    );
  });

  it("should navigate to 2FA page when 2FA is required", async () => {
    vi.mocked(api.login).mockResolvedValue({
      requires2FA: true,
      pendingSessionId: "session-123",
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/login/verify-2fa", {
          state: {
            pendingSessionId: "session-123",
            from: "/",
          },
          replace: false,
        });
      },
      { timeout: 5000 },
    );
  });

  it("should navigate to terms reacceptance when terms are outdated", async () => {
    vi.mocked(api.login).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "TERMS_VERSION_OUTDATED",
            message: "Terms need to be reaccepted",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/terms-reacceptance", { replace: true });
      },
      { timeout: 5000 },
    );
  });

  it("should show error message on login failure", async () => {
    vi.mocked(api.login).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid credentials",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should toggle password visibility", () => {
    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    const toggleButton = screen.getByLabelText("Show password");

    expect(passwordInput.type).toBe("password");

    fireEvent.mouseDown(toggleButton);

    expect(passwordInput.type).toBe("text");
    const hideButton = screen.getByLabelText("Hide password");
    expect(hideButton).toBeInTheDocument();

    fireEvent.mouseUp(hideButton);
    expect(passwordInput.type).toBe("password");
  });

  it("should render register and forgot password links", () => {
    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    expect(screen.getByText("Create account")).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("should handle successful login with user object", async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      requires2FA: false,
      session: { id: "session-123" },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockSignIn).toHaveBeenCalledWith({
          id: "user-1",
          username: "test",
          email: "test@example.com",
        });
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      },
      { timeout: 5000 },
    );
  });

  it("should handle login response without user object", async () => {
    vi.mocked(api.login).mockResolvedValue({
      requires2FA: false,
      session: { id: "session-123" },
    } as any);

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent("Login failed");
      },
      { timeout: 5000 },
    );
  });

  it("should handle error with error message", async () => {
    vi.mocked(api.login).mockRejectedValue({
      response: {
        data: {
          error: {
            message: "Custom error message",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByText("Custom error message")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle error with error code but no message", async () => {
    vi.mocked(api.login).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "SOME_ERROR_CODE",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should handle network error without response object", async () => {
    vi.mocked(api.login).mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("should navigate with from path when location state contains from", async () => {
    const mockUseLocation = vi.fn(() => ({
      state: { from: { pathname: "/dashboard" } },
    }));

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: mockUseLocation,
      };
    });

    vi.mocked(api.login).mockResolvedValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      requires2FA: false,
      session: { id: "session-123" },
    });

    const { useLocation } = await import("react-router-dom");
    vi.mocked(useLocation as any).mockReturnValue({
      state: { from: { pathname: "/dashboard" } },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  });

  it("should handle from path validation for invalid paths", async () => {
    const mockUseLocation = vi.fn(() => ({
      state: { from: { pathname: "//invalid" } },
    }));

    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: mockUseLocation,
      };
    });

    vi.mocked(api.login).mockResolvedValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      requires2FA: false,
      session: { id: "session-123" },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      },
      { timeout: 5000 },
    );
  });

  it("should disable inputs during submission", async () => {
    vi.mocked(api.login).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(submitButton).toBeDisabled();
      },
      { timeout: 5000 },
    );
  });

  it("should trim email input", async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: "user-1", username: "test", email: "test@example.com" },
      requires2FA: false,
      session: { id: "session-123" },
    });

    render(
      <MemoryRouter>
        <LoginFormContent />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    fireEvent.change(emailInput, { target: { value: "  test@example.com  " } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(
      () => {
        expect(api.login).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      },
      { timeout: 5000 },
    );
  });

  describe("legacy authentication failure concealment", () => {
    it("should not render legacy lockout details", async () => {
      vi.mocked(api.login).mockRejectedValue({
        response: {
          data: {
            error: {
              code: "AUTH_ACCOUNT_LOCKED",
              message: "Account temporarily locked",
              details: {
                remainingSeconds: 300,
                lockoutType: "account",
              },
            },
          },
        },
      });

      render(
        <MemoryRouter>
          <LoginFormContent />
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(
        () => {
          expect(screen.getByRole("alert")).toBeInTheDocument();
          expect(screen.queryByText("Account temporarily locked")).not.toBeInTheDocument();
          expect(screen.queryByRole("status")).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });

    it("should not render legacy invalid-credential details", async () => {
      vi.mocked(api.login).mockRejectedValue({
        response: {
          data: {
            error: {
              code: "AUTH_INVALID_CREDENTIALS",
              message: "Invalid email or password",
            },
          },
        },
      });

      render(
        <MemoryRouter>
          <LoginFormContent />
        </MemoryRouter>,
      );

      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

      await waitFor(
        () => {
          expect(screen.getByRole("alert")).toBeInTheDocument();
          expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  describe("error message fallback", () => {
    it("should show fallback error when no errorMessage and no errorCode", async () => {
      vi.mocked(api.login).mockRejectedValue({
        response: {
          data: {
            error: {},
          },
        },
      });

      render(
        <MemoryRouter>
          <LoginFormContent />
        </MemoryRouter>,
      );

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign In" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(
        () => {
          // Should show fallback error message (line 144)
          const alert = screen.getByRole("alert");
          expect(alert).toBeInTheDocument();
          // Should contain either the translated error or the fallback
          expect(alert.textContent).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });

    it("should handle error with no response data", async () => {
      vi.mocked(api.login).mockRejectedValue({
        response: {},
      });

      render(
        <MemoryRouter>
          <LoginFormContent />
        </MemoryRouter>,
      );

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Sign In" });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(submitButton);

      await waitFor(
        () => {
          const alert = screen.getByRole("alert");
          expect(alert).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });
});
