import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageShell } from "../../apps/frontend/src/layouts/PageShell";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "scrollbar.pageLabel": "Page content",
      "footer.expand": "Expand footer",
      "footer.collapse": "Collapse footer",
    })[key] ?? key,
  }),
}));

vi.mock("../../apps/frontend/src/components/CustomScrollbar", () => ({
  CustomScrollbar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="content-scroll">{children}</div>
  ),
}));

describe("PageShell footer collapse", () => {
  it("keeps the header and content mounted while toggling the footer", () => {
    render(
      <PageShell header={<header>Header</header>} footer={<footer>Footer content</footer>}>
        <p>Main content</p>
      </PageShell>,
    );
    const toggle = screen.getByRole("button", { name: "Expand footer" });
    const content = screen.getByText("Footer content").closest('[data-slot="footer-collapsible"]');
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-label", "Expand footer");
    expect(toggle).toHaveAttribute("aria-controls", content?.id);
    expect(content).toHaveAttribute("hidden");
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByTestId("content-scroll")).toHaveTextContent("Main content");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-label", "Collapse footer");
    expect(content).not.toHaveAttribute("hidden");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Footer content");
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByTestId("content-scroll")).toHaveTextContent("Main content");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(content).toHaveAttribute("hidden");
  });

  it("does not render a collapse control when no footer exists", () => {
    render(<PageShell>Content</PageShell>);
    expect(screen.queryByRole("button", { name: /footer/i })).not.toBeInTheDocument();
  });
});
