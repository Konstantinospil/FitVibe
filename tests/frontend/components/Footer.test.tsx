import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { Footer } from "../../src/components/Footer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "footer.brand": "FitVibe",
        "footer.navigationLabel": "Footer navigation",
        "footer.contact": "Contact",
        "footer.terms": "Terms and Conditions",
        "footer.privacy": "Privacy Policy",
        "footer.contactAriaLabel": "Contact us",
        "footer.termsAriaLabel": "View Terms and Conditions",
        "footer.privacyAriaLabel": "View Privacy Policy",
        "brand.logoAlt": "FitVibe",
      };
      return translations[key] || options?.defaultValue || key;
    },
  }),
}));

const renderFooter = () =>
  render(
    <BrowserRouter>
      <Footer />
    </BrowserRouter>,
  );

describe("Footer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the FitVibe logo, three page links, and four social icons", () => {
    renderFooter();

    expect(screen.getByRole("img", { name: "FitVibe" })).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "Footer navigation" });
    expect(navigation.querySelectorAll("a")).toHaveLength(3);

    const social = screen.getByRole("navigation", { name: "Social media" });
    expect(social.querySelectorAll("[data-social-platform]")).toHaveLength(4);
    for (const label of ["Instagram", "LinkedIn", "YouTube", "GitHub"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it.each([
    ["Contact us", "/contact"],
    ["View Terms and Conditions", "/terms"],
    ["View Privacy Policy", "/privacy"],
  ] as const)("renders %s with the correct route", (name, href) => {
    renderFooter();
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  });

  it("keeps social icons disabled until a URL is configured", () => {
    renderFooter();

    for (const label of ["Instagram", "LinkedIn", "YouTube", "GitHub"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByLabelText(label)).toHaveAttribute("data-size", "lg");
    }
  });
});
