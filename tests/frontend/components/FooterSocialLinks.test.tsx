import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FooterSocialLinks from "../../src/components/FooterSocialLinks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? "Social media",
  }),
}));

describe("FooterSocialLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps social destinations disabled when no URL is configured", () => {
    render(<FooterSocialLinks />);

    for (const label of ["Instagram", "LinkedIn", "YouTube", "GitHub"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("renders configured destinations as safe external links", () => {
    vi.stubEnv("VITE_SOCIAL_INSTAGRAM_URL", "https://example.com/instagram");
    vi.stubEnv("VITE_SOCIAL_LINKEDIN_URL", "https://example.com/linkedin");
    vi.stubEnv("VITE_SOCIAL_YOUTUBE_URL", "https://example.com/youtube");
    vi.stubEnv("VITE_SOCIAL_GITHUB_URL", "https://example.com/github");

    render(<FooterSocialLinks />);

    const expected = new Map([
      ["Instagram", "https://example.com/instagram"],
      ["LinkedIn", "https://example.com/linkedin"],
      ["YouTube", "https://example.com/youtube"],
      ["GitHub", "https://example.com/github"],
    ]);

    for (const [label, href] of expected) {
      const link = screen.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).not.toHaveAttribute("aria-disabled", "true");
    }
  });
});
