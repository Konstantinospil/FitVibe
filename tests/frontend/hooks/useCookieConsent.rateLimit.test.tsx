import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transientRetryDelayMs, useCookieConsent } from "../../src/hooks/useCookieConsent";
import { apiClient } from "../../src/services/api";
import { initializeAnalytics } from "../../src/utils/analytics";

vi.mock("../../src/utils/analytics", () => ({
  initializeAnalytics: vi.fn(),
  disableAnalytics: vi.fn(),
}));
vi.mock("../../src/utils/marketing", () => ({
  initializeMarketing: vi.fn(),
  disableMarketing: vi.fn(),
}));
vi.mock("../../src/services/api", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(apiClient.get);
const httpError = (status: number, retryAfter?: string) =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status, headers: retryAfter === undefined ? {} : { "retry-after": retryAfter } },
  });
const granted = {
  data: {
    data: {
      hasConsent: true,
      consent: {
        essential: true,
        preferences: false,
        analytics: true,
        marketing: false,
        version: "v1",
        updatedAt: "now",
      },
    },
  },
};

const Probe = () => {
  const { consentStatus, isLoading, statusUnavailable } = useCookieConsent();
  if (isLoading) return <div>Loading</div>;
  return (
    <div>
      {consentStatus?.hasConsent ? "HasConsent" : "NoConsent"}
      {statusUnavailable ? " Unavailable" : " Confirmed"}
    </div>
  );
};

// issue 634: a rate-limited consent check must not be read as "no consent".
describe("useCookieConsent transient failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a 429 once after Retry-After while still loading", async () => {
    get.mockRejectedValueOnce(httpError(429, "3")).mockResolvedValueOnce(granted as never);
    render(<Probe />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_999);
    });
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText("HasConsent Confirmed")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
    expect(initializeAnalytics).toHaveBeenCalledOnce();
  });

  it("reports the status as unavailable, without consent, when the retry also fails", async () => {
    get.mockRejectedValue(httpError(429, "1"));
    render(<Probe />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText("NoConsent Unavailable")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
    expect(initializeAnalytics).not.toHaveBeenCalled();
  });

  it("does not retry non-transient failures", async () => {
    get.mockRejectedValue(httpError(400));
    render(<Probe />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.getByText("NoConsent Unavailable")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("caps and defaults the retry delay", () => {
    expect(transientRetryDelayMs(httpError(429, "120"))).toBe(10_000);
    expect(transientRetryDelayMs(httpError(503))).toBe(2_000);
    expect(transientRetryDelayMs(httpError(429, "Wed, 21 Oct 2026 07:28:00 GMT"))).toBe(2_000);
    expect(transientRetryDelayMs(httpError(500))).toBeNull();
    expect(transientRetryDelayMs(new Error("Network Error"))).toBeNull();
  });
});
