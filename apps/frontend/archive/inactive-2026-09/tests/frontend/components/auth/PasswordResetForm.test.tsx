import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordResetForm } from "../../src/components/auth/PasswordResetForm";

const forgotPassword = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../src/hooks/useRequiredFieldValidation", () => ({
  useRequiredFieldValidation: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  forgotPassword: (...args: unknown[]) => forgotPassword(...args),
}));

describe("PasswordResetForm", () => {
  beforeEach(() => {
    forgotPassword.mockReset().mockResolvedValue(undefined);
  });

  it("submits an email and shows success", async () => {
    const onSuccess = vi.fn();
    render(
      <MemoryRouter>
        <PasswordResetForm onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user@example.com" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "forgotPassword.sendLink" }).closest("form")!,
    );

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith({ email: "user@example.com" }));
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByText("forgotPassword.successMessage")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "forgotPassword.backToLogin" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("surfaces API errors", async () => {
    const onError = vi.fn();
    forgotPassword.mockRejectedValue({
      response: { data: { error: { message: "Too many requests" } } },
    });

    render(
      <MemoryRouter>
        <PasswordResetForm onError={onError} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user@example.com" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "forgotPassword.sendLink" }).closest("form")!,
    );

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("Too many requests");
  });

  it("falls back to a generic error message", async () => {
    forgotPassword.mockRejectedValue(new Error("offline"));
    render(
      <MemoryRouter>
        <PasswordResetForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "user@example.com" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "forgotPassword.sendLink" }).closest("form")!,
    );

    expect(await screen.findByText("forgotPassword.errorSend")).toBeInTheDocument();
  });
});
