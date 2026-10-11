import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient, rawHttpClient } from "../src/services/api";
import { useAuthStore } from "../src/store/auth.store";
import type { User } from "../src/store/auth.store";

describe("apiClient authentication flow", () => {
  let apiMock: MockAdapter;
  let rawMock: MockAdapter;

  const mockUser: User = {
    id: "user-123",
    username: "testuser",
    email: "test@example.com",
    role: "athlete",
  };

  beforeEach(async () => {
    apiMock = new MockAdapter(apiClient);
    rawMock = new MockAdapter(rawHttpClient);
    rawMock.onGet("/api/v1/csrf-token").reply(200, { csrfToken: "test-csrf-token" });
    
    // Mock logout endpoint to prevent 404 errors during cleanup
    rawMock.onPost("/api/v1/auth/logout").reply(200);
    
    await useAuthStore.getState().signOut();
  });

  afterEach(() => {
    apiMock.restore();
    rawMock.restore();
  });

  it("sends requests with cookies (no Authorization header needed)", async () => {
    useAuthStore.getState().signIn(mockUser);

    apiMock.onGet("/api/protected").reply((config) => {
      // With HttpOnly cookies, no Authorization header should be present
      // The browser automatically sends cookies
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { ok: true }];
    });

    const response = await apiClient.get("/api/protected");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
  });

  it("refreshes a stale CSRF token and retries registration exactly once", async () => {
    let tokenCalls = 0;
    rawMock.onGet("/api/v1/csrf-token").reply(() => {
      tokenCalls += 1;
      return [200, { csrfToken: "fresh" }];
    });
    const headers: string[] = [];
    rawMock.onPost("/api/v1/auth/register").reply((config) => {
      headers.push(String(config.headers?.["X-CSRF-Token"]));
      return headers.length === 1
        ? [403, { error: { code: "CSRF_TOKEN_INVALID" } }]
        : [200, { success: true }];
    });

    const response = await rawHttpClient.post("/api/v1/auth/register", {
      email: "test@example.com",
    });
    expect(response.status).toBe(200);
    expect(headers).toHaveLength(2);
    expect(headers[1]).toBe("fresh");
    expect(tokenCalls).toBeGreaterThanOrEqual(1);
  });

  it("does not retry non-CSRF 403 responses", async () => {
    let calls = 0;
    apiMock.onPost("/api/v1/private").reply(() => {
      calls += 1;
      return [403, { error: { code: "FORBIDDEN" } }];
    });
    await expect(apiClient.post("/api/v1/private")).rejects.toBeDefined();
    expect(calls).toBe(1);
  });

  it("stops after one unsuccessful CSRF retry", async () => {
    let calls = 0;
    rawMock.onPost("/api/v1/auth/register").reply(() => {
      calls += 1;
      return [403, { error: { code: "CSRF_TOKEN_INVALID" } }];
    });
    await expect(rawHttpClient.post("/api/v1/auth/register")).rejects.toBeDefined();
    expect(calls).toBe(2);
  });

  it("refreshes the session on the first 401", async () => {
    // Set authenticated state
    useAuthStore.getState().signIn(mockUser);
    // Ensure state is set
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    let callCount = 0;

    apiMock.onGet("/api/protected").reply(() => {
      callCount += 1;
      if (callCount === 1) {
        return [401];
      }

      // After refresh, request should succeed
      return [200, { ok: true }];
    });

    // Mock the refresh endpoint - no body needed, cookies sent automatically
    rawMock.onPost("/api/v1/auth/refresh").reply(200);

    const response = await apiClient.get("/api/protected");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
    expect(callCount).toBe(2);
    // User should still be authenticated after successful refresh
    // Note: The refresh doesn't change auth state, it just updates cookies
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("signs out when refresh fails", async () => {
    useAuthStore.getState().signIn(mockUser);

    apiMock.onGet("/api/protected").reply(401);
    rawMock.onPost("/api/v1/auth/refresh").reply(400);
    // Mock logout endpoint that might be called during error handling
    rawMock.onPost("/api/v1/auth/logout").reply(200);

    await expect(apiClient.get("/api/protected")).rejects.toBeDefined();

    // Should have signed out
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("handles requests without authentication", async () => {
    // Not signed in
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    apiMock.onGet("/api/public").reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { ok: true }];
    });

    const response = await apiClient.get("/api/public");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ ok: true });
  });

  it("queues concurrent requests during token refresh", async () => {
    useAuthStore.getState().signIn(mockUser);

    let apiCallCount = 0;
    let refreshCallCount = 0;

    apiMock.onGet("/api/protected").reply(() => {
      apiCallCount += 1;
      if (apiCallCount <= 3) {
        // First 3 calls return 401
        return [401];
      }
      // After refresh, succeed
      return [200, { ok: true, call: apiCallCount }];
    });

    rawMock.onPost("/api/v1/auth/refresh").reply(() => {
      refreshCallCount += 1;
      return [200];
    });

    // Make 3 concurrent requests that will all trigger 401
    const promises = [
      apiClient.get("/api/protected"),
      apiClient.get("/api/protected"),
      apiClient.get("/api/protected"),
    ];

    const results = await Promise.all(promises);

    // All should succeed
    results.forEach((res) => {
      expect(res.status).toBe(200);
    });

    // Refresh should only be called once (not 3 times)
    expect(refreshCallCount).toBe(1);
  });
});
