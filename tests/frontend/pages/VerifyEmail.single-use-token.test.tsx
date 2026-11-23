import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../../src/i18n/config";
import VerifyEmail from "../../src/pages/VerifyEmail";
import { rawHttpClient } from "../../src/services/api";

vi.mock("../../src/services/api", async () => {
  const actual = await vi.importActual("../../src/services/api");
  return {
    ...actual,
    rawHttpClient: { get: vi.fn(), post: vi.fn() },
    resendVerificationEmail: vi.fn(),
  };
});

// The app config re-renders translated components when string bundles are
// added (react.bindI18nStore: "added"), which gives `t` a new identity. The
// verification token is single-use, so a re-render must never send it again;
// a second request fails ("already used") and replaced the success state.
describe("VerifyEmail single-use token", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("verifies once even when i18n bundles are added after mount", async () => {
    vi.mocked(rawHttpClient.get).mockResolvedValue({ data: {} });
    await i18n.changeLanguage("en");

    render(
      <MemoryRouter initialEntries={["/verify?token=single-use-token"]}>
        <VerifyEmail />
      </MemoryRouter>,
    );

    await act(async () => {
      i18n.addResourceBundle(
        "en",
        "translation",
        { verifyEmailSingleUseTest: { marker: "late bundle" } },
        true,
        true,
      );
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("button", { name: i18n.t("verifyEmail.goToLogin") }),
    ).toBeVisible();
    expect(rawHttpClient.get).toHaveBeenCalledTimes(1);
    expect(rawHttpClient.get).toHaveBeenCalledWith("/api/v1/auth/verify?token=single-use-token");
  });
});
