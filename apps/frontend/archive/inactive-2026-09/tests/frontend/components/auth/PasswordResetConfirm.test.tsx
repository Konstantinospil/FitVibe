import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordResetConfirm } from "../../src/components/auth/PasswordResetConfirm";

const resetPassword = vi.fn();
const navigate = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../src/hooks/useRequiredFieldValidation", () => ({
  useRequiredFieldValidation: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

describe("PasswordResetConfirm", () => {
  beforeEach(() => {
    resetPassword.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
  });

  it("rejects mismatched passwords", async () => {
    const onError = vi.fn();
    render(
      <MemoryRouter>
        <PasswordResetConfirm token="tok" onError={onError} />
      </MemoryRouter>,
    );

    const [password, confirm] = screen.getAllByPlaceholderText(/resetPassword./);
    fireEvent.change(password, { target: { value: "Password123!x" } });
    fireEvent.change(confirm, { target: { value: "Different123!x" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "resetPassword.resetButton" }).closest("form")!,
    );

    expect(await screen.findByText("resetPassword.passwordMismatch")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("resetPassword.passwordMismatch");
  });

  it("rejects a missing token", async () => {
    render(
      <MemoryRouter>
        <PasswordResetConfirm />
      </MemoryRouter>,
    );

    const [password, confirm] = screen.getAllByPlaceholderText(/resetPassword./);
    fireEvent.change(password, { target: { value: "Password123!x" } });
    fireEvent.change(confirm, { target: { value: "Password123!x" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "resetPassword.resetButton" }).closest("form")!,
    );

    expect(await screen.findByText("resetPassword.invalidToken")).toBeInTheDocument();
  });

  it("resets the password and shows success", async () => {
    const onSuccess = vi.fn();
    render(
      <MemoryRouter>
        <PasswordResetConfirm token="tok" onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    const [password, confirm] = screen.getAllByPlaceholderText(/resetPassword./);
    fireEvent.change(password, { target: { value: "Password123!x" } });
    fireEvent.change(confirm, { target: { value: "Password123!x" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "resetPassword.resetButton" }).closest("form")!,
    );

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({ token: "tok", newPassword: "Password123!x" }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByText("resetPassword.successText")).toBeInTheDocument();
  });

  it("toggles password visibility and surfaces API errors", async () => {
    resetPassword.mockRejectedValue({
      response: { data: { error: { message: "Expired" } } },
    });
    render(
      <MemoryRouter>
        <PasswordResetConfirm token="tok" />
      </MemoryRouter>,
    );

    fireEvent.mouseDown(screen.getAllByLabelText("auth.showPassword")[0]);
    fireEvent.mouseUp(screen.getAllByLabelText("auth.hidePassword")[0]);

    const [password, confirm] = screen.getAllByPlaceholderText(/resetPassword./);
    fireEvent.change(password, { target: { value: "Password123!x" } });
    fireEvent.change(confirm, { target: { value: "Password123!x" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "resetPassword.resetButton" }).closest("form")!,
    );

    expect(await screen.findByText("Expired")).toBeInTheDocument();
  });
});
