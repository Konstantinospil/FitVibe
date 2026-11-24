import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthenticatedPrefetch,
  startAuthenticatedPrefetch,
  takePrefetched,
} from "../../../apps/frontend/src/utils/authenticatedPrefetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authenticatedPrefetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    clearAuthenticatedPrefetch();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    clearAuthenticatedPrefetch();
    vi.unstubAllGlobals();
  });

  it("starts the three reads once, as credentialed GETs", () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    startAuthenticatedPrefetch();
    startAuthenticatedPrefetch();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      "/api/v1/users/me/preferences",
      "/api/v1/auth/legal-documents/status",
      "/api/v1/auth/admin-password/status",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ method: "GET", credentials: "include" });
    }
  });

  it("serves an early result once, then uses the normal request", async () => {
    fetchMock.mockImplementation((url) =>
      Promise.resolve(jsonResponse({ language: "de", from: String(url) })),
    );
    startAuthenticatedPrefetch();
    const load = vi.fn().mockResolvedValue({ language: "en", from: "api-client" });

    await expect(takePrefetched("preferences", load)).resolves.toEqual({
      language: "de",
      from: "/api/v1/users/me/preferences",
    });
    expect(load).not.toHaveBeenCalled();

    await expect(takePrefetched("preferences", load)).resolves.toEqual({
      language: "en",
      from: "api-client",
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an error status", () => Promise.resolve(jsonResponse({ error: "expired" }, 401))],
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["a body that is not JSON", () => Promise.resolve(new Response("<html>", { status: 200 }))],
  ])("leaves %s to the API client", async (_case, respond) => {
    fetchMock.mockImplementation(respond);
    startAuthenticatedPrefetch();
    const load = vi.fn().mockResolvedValue({ terms: { needsAcceptance: false } });

    await expect(takePrefetched("legalDocumentsStatus", load)).resolves.toEqual({
      terms: { needsAcceptance: false },
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("discards unused results when the session changes", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ passwordChangeRequired: false }));
    startAuthenticatedPrefetch();
    clearAuthenticatedPrefetch();
    const load = vi.fn().mockResolvedValue({ passwordChangeRequired: true });

    await expect(takePrefetched("adminPasswordStatus", load)).resolves.toEqual({
      passwordChangeRequired: true,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("uses the normal request when no prefetch was started", async () => {
    const load = vi.fn().mockResolvedValue({ language: "fr" });
    await expect(takePrefetched("preferences", load)).resolves.toEqual({ language: "fr" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
