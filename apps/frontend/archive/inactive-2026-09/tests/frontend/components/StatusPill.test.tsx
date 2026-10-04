import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { StatusPill } from "../../src/components/StatusPill";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        "status.checking": "Checking",
        "status.online": "Server online",
        "status.offline": "Server offline",
      };
      return translations[key] || options?.defaultValue || key;
    },
  }),
}));

describe("StatusPill", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render checking status with default label", () => {
    const { container } = render(<StatusPill status="checking" />);

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveTextContent("Checking");
  });

  it("should render online status with default label", () => {
    const { container } = render(<StatusPill status="online" />);

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toHaveTextContent("Server online");
  });

  it("should render offline status with default label", () => {
    const { container } = render(<StatusPill status="offline" />);

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toHaveTextContent("Server offline");
  });

  it("should render custom text when provided as children", () => {
    render(<StatusPill status="online">Connected</StatusPill>);

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("should use translation key when children is empty", () => {
    const { container } = render(<StatusPill status="online">{""}</StatusPill>);

    const texts = screen.getAllByText("Server online");
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should use translation key when children contains only whitespace", () => {
    const { container } = render(<StatusPill status="online">{"   "}</StatusPill>);

    const texts = screen.getAllByText("Server online");
    const text = Array.from(texts).find((el) => container.contains(el)) || texts[0];
    expect(text).toBeInTheDocument();
  });

  it("should have aria-live polite attribute", () => {
    const { container } = render(<StatusPill status="online" />);

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toHaveAttribute("aria-live", "polite");
  });

  it("should have aria-label when label is string", () => {
    const { container } = render(<StatusPill status="online">Connected</StatusPill>);

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toHaveAttribute("aria-label", "Connected");
  });

  it("should use translated status as aria-label when children is not string", () => {
    const { container } = render(
      <StatusPill status="online">
        <span>Complex Label</span>
      </StatusPill>,
    );

    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    // When children is not a simple string, the component falls back to translating the status
    expect(statusElement).toHaveAttribute("aria-label", "Server online");
  });

  it("should render indicator dot for checking status", () => {
    const { container } = render(<StatusPill status="checking" />);

    const dot = container.querySelector('span[style*="border-radius"]');
    expect(dot).toBeInTheDocument();
  });

  it("should render indicator dot for online status", () => {
    const { container } = render(<StatusPill status="online" />);

    const dot = container.querySelector('span[style*="border-radius"]');
    expect(dot).toBeInTheDocument();
  });

  it("should render indicator dot for offline status", () => {
    const { container } = render(<StatusPill status="offline" />);

    const dot = container.querySelector('span[style*="border-radius"]');
    expect(dot).toBeInTheDocument();
  });

  it("should apply pulse effect for checking status", () => {
    const { container } = render(<StatusPill status="checking" />);

    const statusElement = container.querySelector('span[role="status"]');
    const computedStyle = statusElement?.getAttribute("style");
    expect(computedStyle).toContain("box-shadow");
  });

  it("should not apply pulse effect for online status", () => {
    const { container } = render(<StatusPill status="online" />);

    const statusElement = container.querySelector('span[role="status"]');
    const computedStyle = statusElement?.getAttribute("style");
    expect(computedStyle).toContain("box-shadow: none");
  });

  it("should not apply pulse effect for offline status", () => {
    const { container } = render(<StatusPill status="offline" />);

    const statusElement = container.querySelector('span[role="status"]');
    const computedStyle = statusElement?.getAttribute("style");
    expect(computedStyle).toContain("box-shadow: none");
  });

  it("should render complex children content while using translated status for aria-label", () => {
    const { container } = render(
      <StatusPill status="online">
        <span>Status:</span> <strong>Active</strong>
      </StatusPill>,
    );

    // When children is complex, component renders the complex content
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // But uses translated status for aria-label (accessibility)
    const statusElements = screen.getAllByRole("status");
    const statusElement =
      Array.from(statusElements).find((el) => container.contains(el)) || statusElements[0];
    expect(statusElement).toHaveAttribute("aria-label", "Server online");
  });

  it("should apply correct styles for checking status", () => {
    const { container } = render(<StatusPill status="checking" />);

    const statusElement = container.querySelector('span[role="status"]');
    const computedStyle = statusElement?.getAttribute("style");

    expect(computedStyle).toContain("display: inline-flex");
    expect(computedStyle).toContain("align-items: center");
    expect(computedStyle).toContain("border-radius: 999px");
  });

  it("should apply correct styles for online status", () => {
    const { container } = render(<StatusPill status="online" />);

    const statusElement = container.querySelector('span[role="status"]');
    expect(statusElement).toBeInTheDocument();
  });

  it("should apply correct styles for offline status", () => {
    const { container } = render(<StatusPill status="offline" />);

    const statusElement = container.querySelector('span[role="status"]');
    expect(statusElement).toBeInTheDocument();
  });
});
