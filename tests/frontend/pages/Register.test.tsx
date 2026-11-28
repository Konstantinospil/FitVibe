import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18n from "i18next";
import Register from "../../src/pages/Register";
import * as api from "../../src/services/api";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return { ...actual, startRegistration: vi.fn() };
});

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "auth.register.title": "Create your account",
        "auth.register.description": "Enter your email address.",
        "auth.register.emailLabel": "Email",
        "auth.placeholders.email": "you@example.com",
        "auth.register.startSubmit": "Continue",
        "auth.register.startSubmitting": "Sending…",
        "auth.register.loginPrompt": "Already have an account?",
        "auth.register.loginLink": "Sign in",
        "auth.register.successTitle": "Check your email",
        "auth.register.successDescription": "If this address can be used, we sent the next step.",
        "auth.register.checkEmail": "Check the inbox of {{email}}.",
        "auth.register.goToLogin": "Go to login",
        "auth.register.didntReceiveEmail": "Didn't receive the email?",
        "auth.register.resendEmail": "Send it again",
        "auth.register.resendSuccess": "A new email is on its way.",
        "auth.register.fillAllFields": "Please fill in all fields",
        "auth.register.error": "Something went wrong.",
        "errors.RATE_LIMITED": "Too many requests.",
        "validation.required": "Fill in this field",
      },
    },
  },
});

function renderRegister(state?: { email?: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/register", state }]}>
      <I18nextProvider i18n={testI18n}>
        <Register />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

function submitEmail(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: /email/i }), { target: { value } });
  fireEvent.submit(
    screen.getByRole("textbox", { name: /email/i }).closest("form") as HTMLFormElement,
  );
}

describe("Register (email-first step 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.startRegistration).mockResolvedValue({ message: "accepted" });
  });

  it("asks for the email address only", () => {
    renderRegister();

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("sends the trimmed address with the UI language and shows the same next step for everyone", async () => {
    renderRegister();
    submitEmail("  athlete@example.com ");

    await screen.findByText("Check your email");
    expect(api.startRegistration).toHaveBeenCalledWith({
      email: "athlete@example.com",
      locale: "en",
    });
    expect(screen.getByText("Check the inbox of athlete@example.com.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login");
  });

  it("can send the email again", async () => {
    renderRegister();
    submitEmail("athlete@example.com");
    await screen.findByText("Check your email");

    fireEvent.click(screen.getByRole("button", { name: /send it again/i }));

    await screen.findByText("A new email is on its way.");
    expect(api.startRegistration).toHaveBeenCalledTimes(2);
  });

  it("does not submit an empty address", async () => {
    renderRegister();
    fireEvent.submit(
      screen.getByRole("textbox", { name: /email/i }).closest("form") as HTMLFormElement,
    );

    await screen.findByText("Please fill in all fields");
    expect(api.startRegistration).not.toHaveBeenCalled();
  });

  it("shows a translated error when the request is refused (for example rate limited)", async () => {
    vi.mocked(api.startRegistration).mockRejectedValue({
      response: { data: { error: { code: "RATE_LIMITED" } } },
    });
    renderRegister();
    submitEmail("athlete@example.com");

    await screen.findByText("Too many requests.");
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
  });

  it("shows a generic error for network failures", async () => {
    vi.mocked(api.startRegistration).mockRejectedValue(new Error("offline"));
    renderRegister();
    submitEmail("athlete@example.com");

    await screen.findByText("Something went wrong.");
  });

  it("disables the form while sending", async () => {
    let finish: (value: { message: string }) => void = () => undefined;
    vi.mocked(api.startRegistration).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderRegister();
    submitEmail("athlete@example.com");

    await waitFor(() => expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled());
    finish({ message: "accepted" });
    await screen.findByText("Check your email");
  });

  it("pre-fills the address handed over from another page", () => {
    renderRegister({ email: "handed-over@example.com" });

    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("handed-over@example.com");
  });

  it("links to sign in", () => {
    renderRegister();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
