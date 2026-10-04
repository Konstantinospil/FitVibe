import { describe, expect, it, vi } from "vitest";
import { getErrorMessage, getErrorMessageSync } from "../../src/utils/errorMessages";

const t = (key: string) => `t:${key}`;
const identityT = (key: string) => key;

describe("errorMessages", () => {
  it("returns axios error message when available", () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { data: { error: { message: "Bad request" } } },
    });
    expect(getErrorMessageSync(error, t)).toBe("Bad request");
  });

  it("returns axios data.message when error message is missing", () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { data: { message: "Plain message" } },
    });
    expect(getErrorMessageSync(error, t)).toBe("Plain message");
  });

  it("returns error.message when response data has no message", () => {
    const error = Object.assign(new Error("Default error"), {
      response: { data: {} },
    });
    expect(getErrorMessageSync(error, t)).toBe("Default error");
  });

  it("returns fallbackMessage when error message is empty", () => {
    const error = Object.assign(new Error(""), {
      response: { data: {} },
    });
    expect(getErrorMessageSync(error, identityT, "common.error", "Fallback")).toBe("Fallback");
  });

  it("returns translation fallback when message is unavailable", () => {
    expect(getErrorMessageSync({}, t, "common.error")).toBe("t:common.error");
  });

  it("returns default error when translation is empty", () => {
    const emptyT = () => "";
    expect(getErrorMessageSync({}, emptyT, "common.error")).toBe("An error occurred");
  });

  it("returns fallback for non-error values", () => {
    expect(getErrorMessage("oops")).toBe("oops");
    expect(getErrorMessage({}, "common.error", "Fallback")).toBe("Fallback");
  });

  it("extracts string error payloads from Axios-style errors", () => {
    const error = Object.assign(new Error("fallback"), {
      response: { data: { error: "Server said no" } },
    });
    expect(getErrorMessage(error, undefined, "Fallback", false)).toBe("Server said no");
  });

  it("ignores malformed response objects and null responses", () => {
    const malformed = Object.assign(new Error("Fallback error"), { response: "bad" });
    const nullResponse = Object.assign(new Error("Null response"), { response: null });

    expect(getErrorMessage(malformed, undefined, "Fallback", false)).toBe("Fallback error");
    expect(getErrorMessage(nullResponse, undefined, "Fallback", false)).toBe("Null response");
  });

  it("does not log when logging is disabled or the error is empty", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(getErrorMessage(new Error("quiet"), undefined, "Fallback", false)).toBe("quiet");
    expect(getErrorMessage(null, undefined, "Fallback", true)).toBe("Fallback");
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("falls through to explicit and default fallbacks for empty values", () => {
    expect(getErrorMessage({}, undefined, "Explicit", false)).toBe("Explicit");
    expect(getErrorMessage({}, undefined, "", false)).toBe("An error occurred");
    expect(getErrorMessageSync({}, identityT, undefined, "", false)).toBe("An error occurred");
  });

  it("uses translated fallback only when translation differs from its key", () => {
    expect(getErrorMessageSync({}, t, "common.error", "Fallback", false)).toBe("t:common.error");
    expect(getErrorMessageSync({}, identityT, "common.error", "Fallback", false)).toBe("Fallback");
    expect(getErrorMessageSync({}, t, undefined, "Fallback", false)).toBe("Fallback");
  });

  it("returns nested object error messages only when non-empty", () => {
    const emptyNested = Object.assign(new Error("fallback"), {
      response: { data: { error: { message: "" } } },
    });
    expect(getErrorMessageSync(emptyNested, t, undefined, "Fallback", false)).toBe("fallback");
  });
});
