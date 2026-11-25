import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../../src/services/httpApi", () => ({
  rawHttpClient: { post: (...args: unknown[]) => post(...args) },
}));

import {
  installErrorReporting,
  reportClientError,
  reportLoggedError,
  resetErrorReportingForTests,
} from "../../src/utils/errorReporter";
import { logger } from "../../src/utils/logger";

async function flush(): Promise<void> {
  // The HTTP client is loaded with a dynamic import before posting.
  await vi.waitFor(() => expect(post).toHaveBeenCalled());
}

function sentPayloads(): Array<Record<string, string>> {
  return post.mock.calls.map(([, payload]) => payload as Record<string, string>);
}

describe("errorReporter (ADR-040)", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ status: 204 });
    resetErrorReportingForTests();
    window.history.replaceState(null, "", "/register/complete?token=secret-token#step");
  });

  afterEach(() => {
    resetErrorReportingForTests();
    vi.restoreAllMocks();
  });

  it("sends nothing until installed, so SSR, tests and dev builds stay silent", async () => {
    reportClientError("error", "boom");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).not.toHaveBeenCalled();
  });

  it("reports uncaught errors with the path only, never the query or fragment", async () => {
    installErrorReporting();
    const error = new Error("Pattern invalid for jamie@example.com");
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: error.message,
        error,
        filename: "https://app.example/assets/js/main.js?v=3",
      }),
    );
    await flush();

    expect(post).toHaveBeenCalledWith("/api/v1/client-errors", expect.any(Object));
    const [payload] = sentPayloads();
    expect(payload).toMatchObject({
      kind: "error",
      message: "Pattern invalid for [email]",
      route: "/register/complete",
      source: "https://app.example/assets/js/main.js",
    });
    expect(JSON.stringify(payload)).not.toContain("secret-token");
  });

  it("reports unhandled promise rejections", async () => {
    installErrorReporting();
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: new Error("chunk failed") });
    window.dispatchEvent(event);
    await flush();

    expect(sentPayloads()[0]).toMatchObject({
      kind: "unhandledrejection",
      message: "chunk failed",
    });
  });

  it("ignores failed resource loads and opaque cross-origin script errors", async () => {
    installErrorReporting();
    window.dispatchEvent(new Event("error"));
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    reportClientError("error", "real one");
    await flush();

    expect(sentPayloads().map((payload) => payload.message)).toEqual(["real one"]);
  });

  it("reports logger.error with the message and Error, but never the context", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installErrorReporting();
    logger.error("Login error", new Error("Network Error"), { email: "jamie@example.com" });
    await flush();

    const [payload] = sentPayloads();
    expect(payload).toMatchObject({ kind: "logger", message: "Login error: Network Error" });
    expect(JSON.stringify(payload)).not.toContain("jamie");
  });

  it("sends each distinct error once and at most 10 reports per page", async () => {
    installErrorReporting();
    reportLoggedError("same");
    reportLoggedError("same");
    for (let index = 0; index < 20; index += 1) {
      reportClientError("error", `error ${index}`);
    }
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(post).toHaveBeenCalledTimes(10);
    expect(sentPayloads().filter((payload) => payload.message === "same")).toHaveLength(1);
  });

  it("swallows failed reports instead of logging them, which would loop", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    post.mockRejectedValue(new Error("offline"));
    installErrorReporting();
    reportClientError("error", "boom");
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(post).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("clips oversized fields to the server limits", async () => {
    installErrorReporting();
    reportClientError("error", "m".repeat(5000), "s".repeat(9000));
    await flush();

    const [payload] = sentPayloads();
    expect(payload.message).toHaveLength(1000);
    expect(payload.stack).toHaveLength(4000);
  });
});
