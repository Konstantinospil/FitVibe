import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useCookieConsent, shouldShowCookieBanner } from "../../src/hooks/useCookieConsent";
import { apiClient } from "../../src/services/api";
import { initializeAnalytics, disableAnalytics } from "../../src/utils/analytics";
import { initializeMarketing, disableMarketing } from "../../src/utils/marketing";

vi.mock("../../src/utils/analytics", () => ({ initializeAnalytics: vi.fn(), disableAnalytics: vi.fn() }));
vi.mock("../../src/utils/marketing", () => ({ initializeMarketing: vi.fn(), disableMarketing: vi.fn() }));

vi.mock("../../src/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const TestComponent = () => {
  const { consentStatus, isLoading, error, savePreferences } = useCookieConsent();
  if (isLoading) {
    return <div>Loading</div>;
  }
  return (
    <div>
      <div>{consentStatus?.hasConsent ? "HasConsent" : "NoConsent"}</div>
      <div>{error ? "Error" : "NoError"}</div>
      <button
        type="button"
        onClick={() => {
          void savePreferences({
            essential: true,
            preferences: false,
            analytics: false,
            marketing: false,
          }).catch(() => {});
        }}
      >
        Save
      </button>
    </div>
  );
};

describe("useCookieConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("loads consent status from API", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: true, consent: { essential: true } } },
    });

    render(<TestComponent />);

    expect(await screen.findByText("HasConsent")).toBeInTheDocument();
    expect(screen.getByText("NoError")).toBeInTheDocument();
  });

  it("defaults to no consent on connection errors", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ECONNREFUSED"));

    render(<TestComponent />);

    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("NoError")).toBeInTheDocument();
  });

  it("sets error on non-connection failures", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Boom"));

    render(<TestComponent />);

    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("saves preferences and sets localStorage", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          essential: true,
          preferences: false,
          analytics: false,
          marketing: false,
          version: "v1",
          updatedAt: "now",
        },
      },
    });

    render(<TestComponent />);

    await screen.findByText("NoConsent");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(localStorage.getItem("cookie-consent-banner-shown")).toBe("true"));
    expect(disableAnalytics).toHaveBeenCalledOnce();
    expect(disableMarketing).toHaveBeenCalledOnce();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(initializeMarketing).not.toHaveBeenCalled();
  });

  it("saves preferences with analytics and marketing enabled", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          essential: true,
          preferences: true,
          analytics: true,
          marketing: true,
          version: "v2",
          updatedAt: "later",
        },
      },
    });

    render(<TestComponent />);

    await screen.findByText("NoConsent");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(localStorage.getItem("cookie-consent-banner-shown")).toBe("true"));
    expect(initializeAnalytics).toHaveBeenCalledOnce();
    expect(initializeMarketing).toHaveBeenCalledOnce();
    expect(disableAnalytics).not.toHaveBeenCalled();
    expect(disableMarketing).not.toHaveBeenCalled();
  });

  it("reports errors when saving preferences fails", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Save failed"));

    render(<TestComponent />);

    await screen.findByText("NoConsent");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Error")).toBeInTheDocument());
  });


  it.each(["Network Error", "ERR_NETWORK", "ECONNREFUSED"])(
    "treats %s as a connection failure without displaying an error",
    async (message) => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(message));

      render(<TestComponent />);

      expect(await screen.findByText("NoConsent")).toBeInTheDocument();
      expect(screen.getByText("NoError")).toBeInTheDocument();
    },
  );

  it("handles network errors represented by plain API error objects", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "ERR_NETWORK",
      message: "Network Error",
    });

    render(<TestComponent />);

    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("NoError")).toBeInTheDocument();
  });

  it("reports non-network API error objects as fetch failures", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      message: "Consent service rejected request",
    });

    render(<TestComponent />);

    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("reports malformed API errors without granting consent", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(null);

    render(<TestComponent />);

    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("recovers from an initial fetch failure when consent status is refreshed", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("Consent temporarily unavailable"))
      .mockResolvedValueOnce({ data: { data: { hasConsent: true } } });

    const RefreshComponent = () => {
      const { consentStatus, error, isLoading, refreshStatus } = useCookieConsent();
      return (
        <div>
          <div>{isLoading ? "Loading" : consentStatus?.hasConsent ? "HasConsent" : "NoConsent"}</div>
          <div>{error ? "Error" : "NoError"}</div>
          <button type="button" onClick={() => void refreshStatus()}>
            Refresh consent
          </button>
        </div>
      );
    };

    render(<RefreshComponent />);
    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh consent" }));

    expect(await screen.findByText("HasConsent")).toBeInTheDocument();
    expect(screen.getByText("NoError")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });


  it("does not persist consent or initialize tracking when saving preferences fails", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Consent service unavailable"));

    render(<TestComponent />);
    await screen.findByText("NoConsent");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Error")).toBeInTheDocument();
    expect(screen.getByText("NoConsent")).toBeInTheDocument();
    expect(localStorage.getItem("cookie-consent-banner-shown")).toBeNull();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(initializeMarketing).not.toHaveBeenCalled();
  });

  it("preserves rejected optional consent categories independently of accepted categories", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: {
          essential: true,
          preferences: true,
          analytics: true,
          marketing: false,
          version: "v3",
          updatedAt: "later",
        },
      },
    });

    render(<TestComponent />);
    await screen.findByText("NoConsent");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(localStorage.getItem("cookie-consent-banner-shown")).toBe("true"));
    expect(initializeAnalytics).toHaveBeenCalledOnce();
    expect(disableMarketing).toHaveBeenCalledOnce();
    expect(initializeMarketing).not.toHaveBeenCalled();
    expect(disableAnalytics).not.toHaveBeenCalled();
  });

  it("respects the banner shown localStorage flag", () => {
    expect(shouldShowCookieBanner()).toBe(true);
    localStorage.setItem("cookie-consent-banner-shown", "true");
    expect(shouldShowCookieBanner()).toBe(false);
  });

  it.each([
    { analytics: true, marketing: true },
    { analytics: true, marketing: false },
    { analytics: false, marketing: true },
    { analytics: false, marketing: false },
  ])("restores the correct optional integrations on refresh for %j", async (choices) => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: {
        hasConsent: true,
        consent: {
          essential: true,
          preferences: false,
          ...choices,
          version: "v1",
          updatedAt: "now",
        },
      } },
    });
    render(<TestComponent />);
    expect(await screen.findByText("HasConsent")).toBeInTheDocument();
    if (choices.analytics) {
      expect(initializeAnalytics).toHaveBeenCalledOnce();
      expect(disableAnalytics).not.toHaveBeenCalled();
    } else {
      expect(disableAnalytics).toHaveBeenCalledOnce();
      expect(initializeAnalytics).not.toHaveBeenCalled();
    }
    if (choices.marketing) {
      expect(initializeMarketing).toHaveBeenCalledOnce();
      expect(disableMarketing).not.toHaveBeenCalled();
    } else {
      expect(disableMarketing).toHaveBeenCalledOnce();
      expect(initializeMarketing).not.toHaveBeenCalled();
    }
  });

  it("does not initialize optional integrations when consent is not recorded", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    render(<TestComponent />);
    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(initializeMarketing).not.toHaveBeenCalled();
  });

  it("does not initialize optional integrations when consent details are absent", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: true } },
    });
    render(<TestComponent />);
    expect(await screen.findByText("HasConsent")).toBeInTheDocument();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(initializeMarketing).not.toHaveBeenCalled();
  });

  it("sends the consent source to the API and persists the backend response", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { hasConsent: false } },
    });
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: {
        essential: true,
        preferences: true,
        analytics: false,
        marketing: false,
        version: "policy-v2",
        updatedAt: "2026-10-18T12:00:00Z",
      } },
    });
    const SourceComponent = () => {
      const { savePreferences, consentStatus, isLoading } = useCookieConsent();
      if (isLoading) return <span>Loading</span>;
      return (
        <>
          <button type="button" onClick={() => void savePreferences({
            essential: true,
            preferences: true,
            analytics: false,
            marketing: false,
          }, "policy")}>Save policy</button>
          <span>{consentStatus?.consent?.version ?? "No version"}</span>
        </>
      );
    };
    render(<SourceComponent />);
    await screen.findByRole("button", { name: "Save policy" });
    fireEvent.click(screen.getByRole("button", { name: "Save policy" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/consent/cookie-preferences",
      {
        essential: true,
        preferences: true,
        analytics: false,
        marketing: false,
        source: "policy",
      },
    ));
    expect(await screen.findByText("policy-v2")).toBeInTheDocument();
  });

  it("does not enable optional integrations if the status refresh fails", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network Error"));
    render(<TestComponent />);
    expect(await screen.findByText("NoConsent")).toBeInTheDocument();
    expect(initializeAnalytics).not.toHaveBeenCalled();
    expect(initializeMarketing).not.toHaveBeenCalled();
  });
});
