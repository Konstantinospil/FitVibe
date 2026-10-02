import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TermsReacceptance from "../../src/pages/TermsReacceptance";
import * as api from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";

const mockNavigate = vi.fn();
const mockSignOut = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    NavLink: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../src/services/api", () => ({
  acceptTerms: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth.termsReacceptance.eyebrow": "Terms Update",
        "auth.termsReacceptance.title": "Terms and Conditions Update",
        "auth.termsReacceptance.description": "Please accept the updated terms",
        "auth.termsReacceptance.notice": "Our terms have been updated",
        "auth.termsReacceptance.acceptTerms": "I accept the",
        "auth.termsReacceptance.termsLink": "Terms",
        "auth.termsReacceptance.and": "and",
        "auth.termsReacceptance.privacyLink": "Privacy Policy",
        "auth.termsReacceptance.submit": "Accept",
        "auth.termsReacceptance.submitting": "Accepting...",
        "auth.termsReacceptance.signOut": "Sign Out",
        "auth.termsReacceptance.termsRequired": "You must accept the terms",
        "auth.termsReacceptance.error": "Failed to accept terms",
        "errors.NETWORK_ERROR": "Network error",
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
    },
  }),
}));

describe("TermsReacceptance page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      signIn: vi.fn(),
      signOut: mockSignOut,
      user: null,
      isAuthenticated: false,
      updateUser: vi.fn(),
    });
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        reload: reloadSpy,
      },
      writable: true,
      configurable: true,
    });
  });

  it("should render terms reacceptance form", () => {
    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    expect(screen.getByText("Terms and Conditions Update")).toBeInTheDocument();
    expect(screen.getByText("Please accept the updated terms")).toBeInTheDocument();
    expect(screen.getByText("Our terms have been updated")).toBeInTheDocument();
  });

  it("should show error when submitting without accepting terms", async () => {
    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", { name: "Accept" });
    const form = submitButton.closest("form");
    if (form) {
      fireEvent.submit(form);
    } else {
      fireEvent.click(submitButton);
    }

    await waitFor(
      () => {
        const errorElements = screen.queryAllByText("You must accept the terms");
        const alerts = screen.queryAllByRole("alert");
        expect(errorElements.length + alerts.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("should submit form when terms are accepted", async () => {
    vi.mocked(api.acceptTerms).mockResolvedValue({ message: "Terms accepted" });

    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole("checkbox");
    const submitButton = screen.getByRole("button", { name: "Accept" });

    act(() => {
      fireEvent.click(checkbox);
      fireEvent.click(submitButton);
    });

    await waitFor(
      () => {
        expect(api.acceptTerms).toHaveBeenCalledWith({ terms_accepted: true });
      },
      { timeout: 1000 },
    );
  });

  it("should reload page after successful submission", async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        reload: reloadSpy,
      },
      writable: true,
      configurable: true,
    });

    vi.mocked(api.acceptTerms).mockResolvedValue({ message: "Terms accepted" });

    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole("checkbox");
    const submitButton = screen.getByRole("button", { name: "Accept" });

    act(() => {
      fireEvent.click(checkbox);
      fireEvent.click(submitButton);
    });

    await waitFor(
      () => {
        expect(reloadSpy).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
  });

  it("should show error message when API call fails", async () => {
    vi.mocked(api.acceptTerms).mockRejectedValue({
      response: {
        data: {
          error: {
            code: "NETWORK_ERROR",
            message: "Network error",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole("checkbox");
    const submitButton = screen.getByRole("button", { name: "Accept" });

    act(() => {
      fireEvent.click(checkbox);
      fireEvent.click(submitButton);
    });

    await waitFor(
      () => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it("should show generic error when API call fails without error code", async () => {
    vi.mocked(api.acceptTerms).mockRejectedValue(new Error("Unknown error"));

    render(<TermsReacceptance />);

    const checkbox = screen.getByRole("checkbox");
    const submitButton = screen.getByRole("button", { name: "Accept" });

    act(() => {
      fireEvent.click(checkbox);
      fireEvent.click(submitButton);
    });

    await waitFor(
      () => {
        expect(screen.getByText("Failed to accept terms")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it("should disable form while submitting and settle the request before teardown", async () => {
    let resolveRequest!: (value: { message: string }) => void;
    vi.mocked(api.acceptTerms).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const checkbox = screen.getByRole("checkbox");
    const submitButton = screen.getByRole("button", { name: "Accept" });

    fireEvent.click(checkbox);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(checkbox).toBeDisabled();
      expect(api.acceptTerms).toHaveBeenCalled();
    });

    await act(async () => {
      resolveRequest({ message: "Terms accepted" });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(checkbox).not.toBeDisabled();
    });
  });

  it("should allow signing out", async () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      signOut: mockSignOut,
    });
    mockSignOut.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("should render links to terms and privacy", async () => {
    render(
      <MemoryRouter>
        <TermsReacceptance />
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        const termsLinks = screen.getAllByRole("link").filter(
          (link) => link.getAttribute("href") === "/terms",
        );
        const privacyLinks = screen.getAllByRole("link").filter(
          (link) => link.getAttribute("href") === "/privacy",
        );
        expect(termsLinks.length).toBeGreaterThan(0);
        expect(privacyLinks.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
  });
});
