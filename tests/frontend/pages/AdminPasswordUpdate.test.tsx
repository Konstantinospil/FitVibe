import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminPasswordUpdate from "../../src/pages/AdminPasswordUpdate";
import { changePassword } from "../../src/services/accountApi";
import { useAuth } from "../../src/contexts/AuthContext";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({ minimumPasswordLength: 16 }),
  };
});
vi.mock("../../src/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../src/services/accountApi", () => ({ changePassword: vi.fn() }));
vi.mock("../../src/components/AuthPageLayout", () => ({
  default: ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
}));
vi.mock("../../src/components/PasswordStrengthFeedback", () => ({
  PasswordStrengthFeedback: ({ password, minimum }: { password: string; minimum: number }) => (
    <output data-testid="password-strength" data-minimum={minimum}>{password.length}</output>
  ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockChangePassword = vi.mocked(changePassword);
const mockUseAuth = vi.mocked(useAuth);

const CURRENT = "LegacyAdministrator!";

function form() {
  render(
    <MemoryRouter>
      <AdminPasswordUpdate />
    </MemoryRouter>,
  );
}

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText("auth.adminPasswordTransition.current"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("auth.adminPasswordTransition.new"), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText("auth.adminPasswordTransition.confirm"), {
    target: { value: confirm },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "auth.adminPasswordTransition.submit" }));
}

describe("Legacy administrator password transition (#557)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: "admin-1", username: "administrator", email: "admin@example.com", role: "admin" },
      signIn: vi.fn(),
      signOut: mockSignOut,
      updateUser: vi.fn(),
    });
  });

  afterEach(cleanup);

  it("uses existing password UI and communicates the elevated requirement", () => {
    form();
    expect(screen.getByRole("heading", { name: "auth.adminPasswordTransition.title" })).toBeInTheDocument();
    expect(screen.getByText("auth.adminPasswordTransition.explanation")).toBeInTheDocument();
    expect(screen.getByTestId("password-strength")).toHaveAttribute("data-minimum", "16");
    expect(screen.getByLabelText("auth.adminPasswordTransition.current")).toHaveAttribute(
      "autocomplete", "current-password",
    );
    expect(screen.getByLabelText("auth.adminPasswordTransition.new")).toHaveAttribute(
      "autocomplete", "new-password",
    );
  });

  it("denies mismatched replacement without sending credentials", () => {
    form();
    fill(CURRENT, "CompliantNewPassword2026!", "DifferentNewPassword2026!");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("auth.adminPasswordTransition.mismatch");
    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("denies a replacement shorter than the administrator policy minimum", () => {
    form();
    fill(CURRENT, "short-password");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("auth.adminPasswordTransition.minimum");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("accepts the 16-character boundary and requires new MFA login", async () => {
    mockChangePassword.mockResolvedValue(undefined);
    form();
    fill(CURRENT, "0123456789ABCDEF");
    expect(screen.getByTestId("password-strength")).toHaveAttribute("data-minimum", "16");
    submit();
    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: CURRENT,
        newPassword: "0123456789ABCDEF",
      });
      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { passwordWarning: null, passwordUpdated: true },
      });
    });
  });

  it("preserves a breached-password advisory after successful rotation", async () => {
    mockChangePassword.mockResolvedValue({ passwordWarning: "PASSWORD_BREACHED" });
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { passwordWarning: "PASSWORD_BREACHED", passwordUpdated: true },
      });
    });
  });

  it("preserves the provider-unavailable warning without rejecting the rotation", async () => {
    mockChangePassword.mockResolvedValue({ passwordWarning: "BREACH_CHECK_UNAVAILABLE" });
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { passwordWarning: "BREACH_CHECK_UNAVAILABLE", passwordUpdated: true },
      });
    });
  });

  it("clears local authentication even when the logout request fails after rotation", async () => {
    mockChangePassword.mockResolvedValue(undefined);
    mockSignOut.mockRejectedValueOnce(new Error("unavailable"));
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith("/login", expect.objectContaining({
        replace: true,
      }));
    });
  });

  it.each(["WEAK_PASSWORD", "PASSWORD_REUSED", "USER_INVALID_PASSWORD", "PASSWORD_COMMON"])(
    "retains the form and explains a rejected replacement: %s",
    async (code) => {
      mockChangePassword.mockRejectedValue({ response: { data: { error: { code } } } });
      form();
      fill(CURRENT, "NewlyCompliantAdministrator!");
      submit();
      expect(await screen.findByRole("alert")).toHaveTextContent(`errors.${code}`);
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByLabelText("auth.adminPasswordTransition.new")).toHaveValue(
        "NewlyCompliantAdministrator!",
      );
    },
  );

  it("uses a generic rejection message when the server returns an unknown error", async () => {
    mockChangePassword.mockRejectedValue({
      response: { data: { error: { code: "SOME_NEW_ERROR" } } },
    });
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("auth.adminPasswordTransition.failure");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("uses a generic failure on a network error without signing out", async () => {
    mockChangePassword.mockRejectedValue(new Error("Connection interrupted"));
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("auth.adminPasswordTransition.failure");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("disables the password update button during an in-flight server request", async () => {
    let complete!: (result: undefined) => void;
    mockChangePassword.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    expect(screen.getByRole("button", { name: "auth.adminPasswordTransition.submit" })).toBeDisabled();
    expect(mockChangePassword).toHaveBeenCalledOnce();
    complete(undefined);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledOnce());
  });

  it("clears a previous validation error after correcting the form", async () => {
    mockChangePassword.mockResolvedValue(undefined);
    form();
    fill(CURRENT, "NewlyCompliantAdministrator!", "not-matching");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("auth.adminPasswordTransition.mismatch");
    fill(CURRENT, "NewlyCompliantAdministrator!");
    submit();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(mockChangePassword).toHaveBeenCalledOnce();
    });
  });
});
