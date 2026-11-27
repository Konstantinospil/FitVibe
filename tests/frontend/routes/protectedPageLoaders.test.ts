import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/routes/ProtectedRoutes", () => ({ default: "ProtectedRoutes" }));
vi.mock("../../src/pages/Home", () => ({ default: "Home" }));
vi.mock("../../src/pages/SessionDetail", () => ({ default: "SessionDetail" }));
vi.mock("../../src/pages/Log", () => ({ default: "Log" }));
vi.mock("../../src/pages/LiveWorkout", () => ({ default: "LiveWorkout" }));
vi.mock("../../src/pages/Calendar", () => ({ default: "Calendar" }));
vi.mock("../../src/pages/Library", () => ({ default: "Library" }));
vi.mock("../../src/pages/Dashboard", () => ({ default: "Dashboard" }));
vi.mock("../../src/pages/Settings", () => ({ default: "Settings" }));
vi.mock("../../src/pages/Terms", () => ({ default: "Terms" }));
vi.mock("../../src/pages/Privacy", () => ({ default: "Privacy" }));
vi.mock("../../src/pages/Cookie", () => ({ default: "Cookie" }));
vi.mock("../../src/pages/TermsReacceptance", () => ({ default: "TermsReacceptance" }));
vi.mock("../../src/pages/AdminPasswordUpdate", () => ({ default: "AdminPasswordUpdate" }));

import {
  loadDashboard,
  loadLiveWorkout,
  loadLog,
  loadSessionDetail,
  loadProtectedRoutes,
  loadTerms,
  memoizeImport,
  prefetchProtectedEntry,
} from "../../src/routes/protectedPageLoaders";

describe("protectedPageLoaders (#634)", () => {
  it("returns the same in-flight promise so lazy() reuses the prefetch", () => {
    expect(loadTerms()).toBe(loadTerms());
    expect(loadProtectedRoutes()).toBe(loadProtectedRoutes());
  });

  it("resolves the real module for a route", async () => {
    await expect(loadDashboard()).resolves.toMatchObject({ default: "Dashboard" });
  });

  it("loads the session detail page for dynamic protected paths", async () => {
    prefetchProtectedEntry("/sessions/example-session");
    await expect(loadSessionDetail()).resolves.toMatchObject({ default: "SessionDetail" });
  });

  it("prefetches the manual Log page for /log", async () => {
    prefetchProtectedEntry("/log");
    await expect(loadLog()).resolves.toMatchObject({ default: "Log" });
  });

  it("prefetches the live workout for /start/:id", async () => {
    prefetchProtectedEntry("/start/example-session");
    await expect(loadLiveWorkout()).resolves.toMatchObject({ default: "LiveWorkout" });
  });

  it("does not cache a failed chunk request, so a later render can retry", async () => {
    const load = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new Error("chunk offline"))
      .mockResolvedValueOnce({ default: "ok" });
    const memoized = memoizeImport(load);

    await expect(memoized()).rejects.toThrow("chunk offline");
    await expect(memoized()).resolves.toEqual({ default: "ok" });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("prefetches the matching page for normalized paths and ignores unknown paths", async () => {
    expect(() => prefetchProtectedEntry("/Dashboard/")).not.toThrow();
    expect(() => prefetchProtectedEntry("/not-a-protected-page")).not.toThrow();
    // The prefetch shares the same promise the router will later await.
    await expect(loadDashboard()).resolves.toMatchObject({ default: "Dashboard" });
  });
});
