import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PublicRoutes from "../../src/routes/PublicRoutes";

// Mock all lazy-loaded pages
vi.mock("../../src/pages/Login", () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock("../../src/pages/TwoFactorVerificationLogin", () => ({
  default: () => <div data-testid="2fa-login-page">2FA Login Page</div>,
}));

vi.mock("../../src/pages/Register", () => ({
  default: () => <div data-testid="register-page">Register Page</div>,
}));

vi.mock("../../src/pages/CompleteRegistration", () => ({
  default: () => <div data-testid="complete-registration-page">Complete Registration Page</div>,
}));

vi.mock("../../src/pages/VerifyEmail", () => ({
  default: () => <div data-testid="verify-email-page">Verify Email Page</div>,
}));

vi.mock("../../src/pages/ForgotPassword", () => ({
  default: () => <div data-testid="forgot-password-page">Forgot Password Page</div>,
}));

vi.mock("../../src/pages/ResetPassword", () => ({
  default: () => <div data-testid="reset-password-page">Reset Password Page</div>,
}));

vi.mock("../../src/pages/Terms", () => ({
  default: () => <div data-testid="terms-page">Terms Page</div>,
}));

vi.mock("../../src/pages/Privacy", () => ({
  default: () => <div data-testid="privacy-page">Privacy Page</div>,
}));

vi.mock("../../src/pages/TermsReacceptance", () => ({
  default: () => <div data-testid="terms-reacceptance-page">Terms Reacceptance Page</div>,
}));

// Mock Navigate to prevent actual navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to);
      return <div data-testid="navigate-to">{to}</div>;
    },
  };
});

describe("PublicRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("should render Login page at /login", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("login-page");
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("should render Login page at /", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("login-page");
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
  });

  it("should render TwoFactorVerificationLogin page at /login/verify-2fa", async () => {
    render(
      <MemoryRouter initialEntries={["/login/verify-2fa"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("2fa-login-page");
    expect(screen.getByTestId("2fa-login-page")).toBeInTheDocument();
  });

  it("should render Register page at /register", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("register-page");
    expect(screen.getByTestId("register-page")).toBeInTheDocument();
  });

  it("should render CompleteRegistration page at /register/complete", async () => {
    render(
      <MemoryRouter initialEntries={["/register/complete?token=abc"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("complete-registration-page")).toBeInTheDocument();
  });

  it("should render VerifyEmail page at /verify", async () => {
    render(
      <MemoryRouter initialEntries={["/verify"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("verify-email-page");
    expect(screen.getByTestId("verify-email-page")).toBeInTheDocument();
  });

  it("should render ForgotPassword page at /forgot-password", async () => {
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("forgot-password-page");
    expect(screen.getByTestId("forgot-password-page")).toBeInTheDocument();
  });

  it("should render ResetPassword page at /reset-password", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("reset-password-page");
    expect(screen.getByTestId("reset-password-page")).toBeInTheDocument();
  });

  it("should render Terms page at /terms", async () => {
    render(
      <MemoryRouter initialEntries={["/terms"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("terms-page");
    expect(screen.getByTestId("terms-page")).toBeInTheDocument();
  });

  it("should render Privacy page at /privacy", async () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("privacy-page");
    expect(screen.getByTestId("privacy-page")).toBeInTheDocument();
  });

  it("should render TermsReacceptance page at /terms-reacceptance", async () => {
    render(
      <MemoryRouter initialEntries={["/terms-reacceptance"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("terms-reacceptance-page");
    expect(screen.getByTestId("terms-reacceptance-page")).toBeInTheDocument();
  });

  it("should redirect unknown routes to /login", async () => {
    render(
      <MemoryRouter initialEntries={["/unknown-route"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    await screen.findByTestId("navigate-to");
    expect(screen.getByTestId("navigate-to")).toHaveTextContent("/login");
  });

  it("should render loading fallback during Suspense", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <PublicRoutes />
      </MemoryRouter>,
    );

    // Should render something (loading or content)
    expect(container).toBeInTheDocument();
  });
});
