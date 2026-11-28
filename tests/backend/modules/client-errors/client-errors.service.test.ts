import { describe, expect, it, jest } from "@jest/globals";

const warn = jest.fn();
const incrementClientErrorReport = jest.fn();

jest.mock("../../../../apps/backend/src/config/logger.js", () => ({
  logger: { warn: (...args: unknown[]) => warn(...args) },
}));
jest.mock("../../../../apps/backend/src/observability/metrics.js", () => ({
  incrementClientErrorReport: (...args: unknown[]) => incrementClientErrorReport(...args),
}));

import { ClientErrorReportSchema } from "../../../../apps/backend/src/modules/client-errors/client-errors.schemas.js";
import {
  recordClientError,
  sanitizeClientErrorText,
} from "../../../../apps/backend/src/modules/client-errors/client-errors.service.js";

describe("ClientErrorReportSchema", () => {
  const valid = { kind: "error", message: "boom", route: "/dashboard" };

  it("accepts a minimal report", () => {
    expect(ClientErrorReportSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown fields so reports cannot carry identities or free-form context", () => {
    expect(ClientErrorReportSchema.safeParse({ ...valid, userId: "u1" }).success).toBe(false);
    expect(ClientErrorReportSchema.safeParse({ ...valid, context: { a: 1 } }).success).toBe(false);
  });

  it("rejects unknown kinds, oversized fields and non-path routes", () => {
    expect(ClientErrorReportSchema.safeParse({ ...valid, kind: "console" }).success).toBe(false);
    expect(ClientErrorReportSchema.safeParse({ ...valid, message: "x".repeat(1001) }).success).toBe(
      false,
    );
    expect(ClientErrorReportSchema.safeParse({ ...valid, stack: "x".repeat(4001) }).success).toBe(
      false,
    );
    expect(
      ClientErrorReportSchema.safeParse({ ...valid, route: "https://evil.example/" }).success,
    ).toBe(false);
  });
});

describe("sanitizeClientErrorText", () => {
  it("drops query strings and fragments, which can carry one-time tokens", () => {
    expect(
      sanitizeClientErrorText(
        "Pattern invalid (http://127.0.0.1:4180/register/complete?token=USK7rsWeW7y#frag)",
      ),
    ).toBe("Pattern invalid (http://127.0.0.1:4180/register/complete)");
  });

  it("replaces email addresses", () => {
    expect(sanitizeClientErrorText("No account for jamie.runner@example.com found")).toBe(
      "No account for [email] found",
    );
  });

  it("removes control characters but keeps stack line breaks", () => {
    expect(sanitizeClientErrorText("a\u0000b\u001bc\nat x")).toBe("abc\nat x");
  });
});

describe("recordClientError", () => {
  it("logs the sanitized report with the request id and counts it by kind", () => {
    recordClientError(
      {
        kind: "unhandledrejection",
        message: "Failed for a@b.co",
        stack: "at https://app.example/assets/main.js?v=1:1:2",
        route: "/reset-password",
      },
      "req-1",
    );

    expect(incrementClientErrorReport).toHaveBeenCalledWith("unhandledrejection");
    expect(warn).toHaveBeenCalledWith(
      {
        clientError: {
          kind: "unhandledrejection",
          message: "Failed for [email]",
          stack: "at https://app.example/assets/main.js",
          route: "/reset-password",
        },
        requestId: "req-1",
      },
      "[client-error] Browser reported an error",
    );
  });
});
