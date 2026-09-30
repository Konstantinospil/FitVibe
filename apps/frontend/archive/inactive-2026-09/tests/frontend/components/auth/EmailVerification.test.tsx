import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailVerification } from "../../src/components/auth/EmailVerification";

const resendVerificationEmail = vi.fn();
const verifyEmailToken = vi.fn();
const showToast = vi.fn();
const navigate = vi.fn();
const tState = { impl: (key: string) => key };
const t = (key: string) => tState.impl(key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../src/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../src/services/api", () => ({
  resendVerificationEmail: (...args: unknown[]) => resendVerificationEmail(...args),
  verifyEmailToken: (...args: unknown[]) => verifyEmailToken(...args),
}));

describe("EmailVerification", () => {
  beforeEach(() => {
    tState.impl = (key: string) => key;
    resendVerificationEmail.mockReset().mockResolvedValue(undefined);
    verifyEmailToken.mockReset().mockResolvedValue(undefined);
    showToast.mockReset();
    navigate.mockReset();
    vi.useRealTimers();
  });

  it("requires an email before resending", async () => {
    render(
      <MemoryRouter>
        <EmailVerification />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /auth.verification.resend/ }));
    expect(await screen.findByText("auth.verification.emailRequired")).toBeInTheDocument();
  });

  it("resends a verification email", async () => {
    render(
      <MemoryRouter>
        <EmailVerification />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("auth.verification.emailPlaceholder"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /auth.verification.resend/ }));

    await waitFor(() =>
      expect(resendVerificationEmail).toHaveBeenCalledWith({ email: "user@example.com" }),
    );
    expect(showToast).toHaveBeenCalledWith({
      variant: "success",
      title: "auth.verification.emailSent",
      message: "auth.verification.checkInbox",
    });
  });

  it("shows a resend failure", async () => {
    resendVerificationEmail.mockRejectedValue(new Error("fail"));
    render(
      <MemoryRouter>
        <EmailVerification />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("auth.verification.emailPlaceholder"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /auth.verification.resend/ }));
    expect(await screen.findByText("auth.verification.resendFailed")).toBeInTheDocument();
  });

  it("verifies a token from the URL", async () => {
    const onVerified = vi.fn();
    render(
      <MemoryRouter initialEntries={["/verify?token=abc"]}>
        <Routes>
          <Route path="/verify" element={<EmailVerification onVerified={onVerified} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("auth.verification.verifying")).toBeInTheDocument();
    expect(await screen.findByText("auth.verification.verified")).toBeInTheDocument();
    expect(verifyEmailToken).toHaveBeenCalledWith("abc");
    expect(onVerified).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "common.continue" }));
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("uses English copy when translations are empty", () => {
    tState.impl = () => "";
    render(
      <MemoryRouter>
        <EmailVerification />
      </MemoryRouter>,
    );

    expect(screen.getByText("Verify Your Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend Verification Email" })).toBeInTheDocument();
  });
});
