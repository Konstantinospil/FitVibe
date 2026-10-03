import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "../../src/components/auth/RegistrationForm";

const registerAccount = vi.fn();
const resendVerificationEmail = vi.fn();

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("../../src/hooks/useRequiredFieldValidation", () => ({
  useRequiredFieldValidation: vi.fn(),
}));

vi.mock("../../src/hooks/useCountdown", () => ({
  useCountdown: () => [0, false, vi.fn()],
}));

vi.mock("../../src/services/api", () => ({
  register: (...args: unknown[]) => registerAccount(...args),
  resendVerificationEmail: (...args: unknown[]) => resendVerificationEmail(...args),
}));

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText("auth.placeholders.name"), {
    target: { value: "Alex" },
  });
  fireEvent.change(screen.getByPlaceholderText("auth.placeholders.email"), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
    target: { value: "StrongPass123!" },
  });
  fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
    target: { value: "StrongPass123!" },
  });
  const checkboxes = screen.getAllByRole("checkbox");
  fireEvent.click(checkboxes[0]);
  fireEvent.click(checkboxes[1]);
}

describe("RegistrationForm", () => {
  beforeEach(() => {
    registerAccount.mockReset().mockResolvedValue(undefined);
    resendVerificationEmail.mockReset().mockResolvedValue(undefined);
  });

  it("requires all fields before submitting", async () => {
    const onError = vi.fn();
    render(
      <MemoryRouter>
        <RegistrationForm onError={onError} />
      </MemoryRouter>,
    );

    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(await screen.findByText("auth.register.fillAllFields")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith("auth.register.fillAllFields");
  });

  it("requires terms acceptance", async () => {
    render(
      <MemoryRouter>
        <RegistrationForm />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.email"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);

    expect(await screen.findByText("auth.register.termsRequired")).toBeInTheDocument();
  });

  it("registers a user and can resend verification", async () => {
    const onSuccess = vi.fn();
    render(
      <MemoryRouter>
        <RegistrationForm onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    fillValidForm();
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);

    await waitFor(() =>
      expect(registerAccount).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "StrongPass123!",
        username: "alex",
        terms_accepted: true,
        profile: { display_name: "Alex" },
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith("alex@example.com");

    fireEvent.click(screen.getByRole("button", { name: "auth.register.resendEmail" }));
    await waitFor(() =>
      expect(resendVerificationEmail).toHaveBeenCalledWith({ email: "alex@example.com" }),
    );
  });

  it("surfaces API errors", async () => {
    registerAccount.mockRejectedValue({
      response: { data: { error: { code: "USER_EMAIL_EXISTS" } } },
    });
    render(
      <MemoryRouter>
        <RegistrationForm />
      </MemoryRouter>,
    );

    fillValidForm();
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(await screen.findByText("errors.USER_EMAIL_EXISTS")).toBeInTheDocument();
  });

  it("rejects mismatched and weak passwords and invalid usernames", async () => {
    const onError = vi.fn();
    render(
      <MemoryRouter>
        <RegistrationForm onError={onError} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.email"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
      target: { value: "DifferentPass123!" },
    });
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(await screen.findByText("auth.register.passwordMismatch")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("errors.WEAK_PASSWORD"));

    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
      target: { value: "StrongPass123!" },
    });
    const username = screen.getByDisplayValue("alex");
    fireEvent.change(username, { target: { value: "ab" } });
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(await screen.findByText("errors.USER_USERNAME_INVALID")).toBeInTheDocument();

    fireEvent.change(username, { target: { value: "bad name" } });
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    expect(screen.getByText("errors.USER_USERNAME_INVALID")).toBeInTheDocument();
  });

  it("prefills email, shows success, and resends verification", async () => {
    const onSuccess = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: "/register", state: { email: "pre@ex.com" } }]}>
        <RegistrationForm onSuccess={onSuccess} />
      </MemoryRouter>,
    );

    expect(screen.getByDisplayValue("pre@ex.com")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.name"), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.password"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.placeholders.confirmPassword"), {
      target: { value: "StrongPass123!" },
    });
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.submit(screen.getByPlaceholderText("auth.placeholders.email").closest("form")!);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("pre@ex.com"));

    resendVerificationEmail.mockRejectedValueOnce({
      response: { data: { error: { code: "RATE_LIMITED", retryAfter: 30 } } },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.register.resendEmail" }));
    await waitFor(() => expect(screen.getByText("errors.RATE_LIMITED")).toBeInTheDocument());

    resendVerificationEmail.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "auth.register.resendEmail" }));
    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalledTimes(2));
  });
});
