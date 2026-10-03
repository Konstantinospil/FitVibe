import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, afterEach } from "vitest";
import NotFound from "../../src/pages/NotFound";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "notFound.eyebrow": "404 Error",
        "notFound.title": "Page Not Found",
        "notFound.description": "The page you're looking for doesn't exist.",
        "notFound.takeMeHome": "Go to Dashboard",
        "notFound.goToLanding": "Go to Home",
      },
    },
  },
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>
    </BrowserRouter>,
  );
};

describe("NotFound", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders 404 error message", () => {
    const { unmount } = renderWithRouter(<NotFound />);

    expect(screen.getByText("404 Error")).toBeInTheDocument();
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText("The page you're looking for doesn't exist.")).toBeInTheDocument();
    unmount();
  });

  it("renders navigation links", () => {
    const { unmount } = renderWithRouter(<NotFound />);

    const dashboardLink = screen.getByRole("link", { name: /go to dashboard/i });
    const homeLink = screen.getByRole("link", { name: /go to home/i });

    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");

    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
    unmount();
  });

  it("renders PageIntro component with correct props", () => {
    const { unmount } = renderWithRouter(<NotFound />);

    // PageIntro should render the eyebrow, title, and description
    expect(screen.getByText("404 Error")).toBeInTheDocument();
    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    unmount();
  });
});
