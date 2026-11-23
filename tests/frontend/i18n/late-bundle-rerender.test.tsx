import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../src/i18n/config";

// Public pages can render before the string bundle they need has been added
// (e.g. the Terms/Privacy page title when the published legal document has a
// content snapshot). Components must re-render once i18n.addResourceBundle
// adds those strings; otherwise the raw key ("terms.title") stays on screen.
function LateTitle() {
  const { t } = useTranslation();
  return <h1>{t("lateBundleTest.title")}</h1>;
}

describe("translated components re-render when strings are added later", () => {
  // The test key is unique, so the shared English bundle needs no cleanup.
  afterEach(() => {
    cleanup();
  });

  it("replaces a raw key once its bundle is added", async () => {
    await i18n.changeLanguage("en");
    render(<LateTitle />);
    expect(screen.getByRole("heading")).toHaveTextContent("lateBundleTest.title");

    act(() => {
      // Same call the app makes when a lazy string bundle arrives.
      i18n.addResourceBundle(
        "en",
        "translation",
        { lateBundleTest: { title: "Terms and Conditions" } },
        true,
        true,
      );
    });

    expect(screen.getByRole("heading")).toHaveTextContent("Terms and Conditions");
  });
});
