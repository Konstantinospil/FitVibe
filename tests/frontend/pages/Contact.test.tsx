import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Contact from "../../src/pages/Contact";
import { rawHttpClient } from "../../src/services/api";
import { useToast } from "../../src/contexts/ToastContext";
import { useAuthStore } from "../../src/store/auth.store";

vi.mock("../../src/services/api", () => ({
  rawHttpClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../src/contexts/ToastContext", () => ({
  useToast: vi.fn(),
}));

vi.mock("../../src/store/auth.store", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../src/hooks/useRequiredFieldValidation", () => ({
  useRequiredFieldValidation: vi.fn(),
}));

vi.mock("../../src/components/PageIntro", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();

const setAnonymousUser = () => {
  vi.mocked(useAuthStore).mockImplementation((selector: any) => selector({ user: null }));
};

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Support" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please help" } });
};

describe("Contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAnonymousUser();
    vi.mocked(useToast).mockReturnValue({
      success: toastSuccess,
      error: toastError,
    } as ReturnType<typeof useToast>);
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { csrfToken: "csrf-token" } } as never);
  });

  it("validates required fields and email format", async () => {
    render(<Contact />);
    const submit = screen.getByRole("button", { name: "Send Message" });
    const form = submit.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    expect(await screen.findByText("Email is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.submit(form!);
    expect(await screen.findByText("Topic is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Support" } });
    fireEvent.submit(form!);
    expect(await screen.findByText("Message is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid-email" } });
    fireEvent.submit(form!);
    expect(await screen.findByText("Please enter a valid email address")).toBeInTheDocument();
    expect(rawHttpClient.post).not.toHaveBeenCalled();
  });

  it("submits an anonymous message and clears all fields on success", async () => {
    vi.mocked(rawHttpClient.post).mockResolvedValue({ data: { success: true } } as never);
    render(<Contact />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    await waitFor(() => expect(rawHttpClient.post).toHaveBeenCalled());
    expect(rawHttpClient.post).toHaveBeenCalledWith(
      "/api/v1/contact",
      {
        email: "user@example.com",
        topic: "Support",
        message: "Please help",
        _csrf: "csrf-token",
      },
      expect.objectContaining({
        headers: { "x-csrf-token": "csrf-token" },
        withCredentials: true,
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Your message has been sent successfully!");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Topic")).toHaveValue("");
    expect(screen.getByLabelText("Message")).toHaveValue("");
  });

  it("keeps the authenticated email and handles a non-success response", async () => {
    vi.mocked(useAuthStore).mockImplementation((selector: any) =>
      selector({ user: { email: "athlete@example.com" } }),
    );
    vi.mocked(rawHttpClient.post).mockResolvedValue({ data: { success: false } } as never);

    render(<Contact />);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("athlete@example.com");
    expect(email).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "Support" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    await waitFor(() => expect(rawHttpClient.post).toHaveBeenCalled());
    expect(email).toHaveValue("athlete@example.com");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows the dedicated CSRF error returned by the API", async () => {
    vi.mocked(rawHttpClient.post).mockRejectedValue({
      response: { data: { error: { code: "CSRF_TOKEN_INVALID" } } },
    });
    render(<Contact />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    const error = await screen.findByText(
      "Security token error. Please refresh the page and try again.",
    );
    expect(error).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(error.textContent);
  });

  it("retries CSRF failures with a fresh token before surfacing an error", async () => {
    vi.mocked(rawHttpClient.get)
      .mockResolvedValueOnce({ data: { csrfToken: "prefetch" } } as never)
      .mockResolvedValueOnce({ data: { csrfToken: "csrf-1" } } as never)
      .mockResolvedValueOnce({ data: { csrfToken: "csrf-2" } } as never);

    vi.mocked(rawHttpClient.post)
      .mockRejectedValueOnce({
        response: { data: { error: { code: "CSRF_TOKEN_INVALID" } } },
      })
      .mockResolvedValueOnce({ data: { success: true } } as never);

    render(<Contact />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    await waitFor(() => {
      expect(rawHttpClient.post).toHaveBeenCalledTimes(2);
    });
    expect(rawHttpClient.post).toHaveBeenLastCalledWith(
      "/api/v1/contact",
      expect.objectContaining({ _csrf: "csrf-2" }),
      expect.objectContaining({
        headers: { "x-csrf-token": "csrf-2" },
        withCredentials: true,
      }),
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows the dedicated network error from the archived resilience behavior", async () => {
    vi.mocked(rawHttpClient.post).mockRejectedValueOnce({ code: "ERR_NETWORK" });
    render(<Contact />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    const error = await screen.findByText(
      "Cannot connect to server. Please check your connection and try again.",
    );
    expect(error).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(error.textContent);
  });

  it("uses an API error message when one is supplied", async () => {
    vi.mocked(rawHttpClient.post).mockRejectedValue({
      response: { data: { error: { code: "CONTACT_REJECTED", message: "Try later" } } },
    });
    render(<Contact />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    expect(await screen.findByText("Try later")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Try later");
  });

  it("falls back to the generic error for response and network failures", async () => {
    vi.mocked(rawHttpClient.post).mockRejectedValueOnce({
      response: { data: { error: {} } },
    });
    const { unmount } = render(<Contact />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));
    expect(await screen.findByText("Failed to send message. Please try again.")).toBeInTheDocument();

    unmount();
    vi.clearAllMocks();
    setAnonymousUser();
    vi.mocked(useToast).mockReturnValue({
      success: toastSuccess,
      error: toastError,
    } as ReturnType<typeof useToast>);
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: { csrfToken: "csrf-token" } } as never);
    vi.mocked(rawHttpClient.post).mockRejectedValue("network");

    render(<Contact />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    expect(await screen.findByText("Failed to send message. Please try again.")).toBeInTheDocument();
  });
});
