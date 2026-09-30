import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LegalDocumentShell from "../../src/components/LegalDocumentShell";

describe("LegalDocumentShell", () => {
  it("renders the Figma legal-document structure", () => {
    render(
      <LegalDocumentShell
        title="Privacy Policy"
        effectiveDate="22.12.2024"
        version="2024.12"
        footerAction={<button type="button">Revoke</button>}
      >
        <section>
          <h2>Content</h2>
          <p>Policy text</p>
        </section>
      </LegalDocumentShell>,
    );

    const shell = screen.getByText("Privacy Policy").closest("[data-component='legal-document-shell']");
    expect(shell).toBeInTheDocument();
    expect(screen.getByText(/Effective date:/)).toBeInTheDocument();
    expect(screen.getByText("22.12.2024")).toBeInTheDocument();
    expect(screen.getByText(/Version:/)).toBeInTheDocument();
    expect(screen.getByText("Policy text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });
});
