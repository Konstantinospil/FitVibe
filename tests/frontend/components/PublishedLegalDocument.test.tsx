import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishedLegalDocument from "../../src/components/PublishedLegalDocument";

const { getPublishedLegalDocument, ensureLegalTranslationsLoaded, i18nState } = vi.hoisted(() => ({
  getPublishedLegalDocument: vi.fn(),
  ensureLegalTranslationsLoaded: vi.fn().mockResolvedValue(undefined),
  i18nState: {
    language: "en-US",
    bundle: {} as unknown,
  },
}));

vi.mock("../../src/services/api", () => ({
  getPublishedLegalDocument,
}));

vi.mock("../../src/i18n/config", () => ({
  ensureLegalTranslationsLoaded,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      get language() {
        return i18nState.language;
      },
      getResourceBundle: vi.fn(() => i18nState.bundle),
    },
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock("../../src/components/LegalDocumentShell", () => ({
  default: ({
    title,
    effectiveDate,
    version,
    legacyNotice,
    footerAction,
    children,
  }: {
    title: React.ReactNode;
    effectiveDate?: string | null;
    version?: string;
    legacyNotice?: string;
    footerAction?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <article>
      <h1>{title}</h1>
      {effectiveDate ? <div data-testid="effective-date">{effectiveDate}</div> : null}
      {version ? <div data-testid="version">{version}</div> : null}
      {legacyNotice ? <div data-testid="legacy-notice">{legacyNotice}</div> : null}
      <div>{children}</div>
      {footerAction ? <footer>{footerAction}</footer> : null}
    </article>
  ),
}));

const published = (content: Record<string, unknown>, overrides: Record<string, unknown> = {}) =>
  ({
    documentType: "terms",
    version: "v2",
    changeClass: "material",
    userAction: "accept",
    effectiveAt: "2026-10-01T12:00:00.000Z",
    publishedAt: "2026-10-01T10:00:00.000Z",
    language: "en",
    legacyWithoutSnapshot: false,
    content,
    ...overrides,
  }) as never;

describe("PublishedLegalDocument", () => {
  beforeEach(() => {
    getPublishedLegalDocument.mockReset();
    ensureLegalTranslationsLoaded.mockClear();
    i18nState.language = "en-US";
    i18nState.bundle = {};
  });

  afterEach(() => cleanup());

  it("renders structured authoritative content in natural order", async () => {
    getPublishedLegalDocument.mockResolvedValue(
      published({
        title: "Authoritative Terms",
        description: "excluded",
        effectiveDate: "excluded",
        section10: { title: "Section 10", content: "Ten" },
        section2: { title: "Section 2", content: "Two" },
        intro: "Introduction",
        count: 7,
        enabled: true,
        nothing: null,
        unsupported: Symbol("ignored"),
        list: [
          "plain",
          { title: "Titled", content: "Body" },
          { title: "Title only" },
          { content: "Content only" },
          { nested: "Nested object value" },
        ],
        table: {
          headers: { first: "Column A", second: "Column B" },
          rows: {
            first: { a: "A1", b: "B1" },
            second: "single cell",
          },
        },
        emptyTable: { headers: {}, rows: {} },
      }),
    );

    render(
      <PublishedLegalDocument
        documentType="terms"
        title="Fallback title"
        footerAction={<button>Footer action</button>}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Authoritative Terms",
    );
    expect(getPublishedLegalDocument).toHaveBeenCalledWith("terms", "en");
    expect(screen.getByTestId("version")).toHaveTextContent("v2");
    expect(screen.getByTestId("effective-date").textContent).toBeTruthy();
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.queryByText("Symbol(ignored)")).not.toBeInTheDocument();
    expect(screen.getByText("Titled").tagName).toBe("STRONG");
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Title only")).toBeInTheDocument();
    expect(screen.getByText("Content only")).toBeInTheDocument();
    expect(screen.getByText("Nested object value")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Column A")).toBeInTheDocument();
    expect(within(table).getByText("A1")).toBeInTheDocument();
    expect(within(table).getByText("single cell")).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings.indexOf("Section 2")).toBeLessThan(headings.indexOf("Section 10"));
    expect(screen.getByRole("button", { name: "Footer action" })).toBeInTheDocument();
  });

  it("falls back to retained localized legacy content and metadata", async () => {
    i18nState.language = "de-DE";
    i18nState.bundle = {
      title: "Historische Bedingungen",
      effectiveDateValue: 20261001,
      section1: { content: "Legacy content" },
    };
    getPublishedLegalDocument.mockResolvedValue(
      published(null as never, {
        version: undefined,
        effectiveAt: null,
        legacyWithoutSnapshot: true,
        content: null,
      }),
    );

    render(<PublishedLegalDocument documentType="terms" title="Fallback title" />);

    expect(await screen.findByText("Legacy content")).toBeInTheDocument();
    expect(ensureLegalTranslationsLoaded).toHaveBeenCalled();
    expect(getPublishedLegalDocument).toHaveBeenCalledWith("terms", "de");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Historische Bedingungen",
    );
    expect(screen.getByTestId("version")).toHaveTextContent("legacy");
    expect(screen.getByTestId("effective-date")).toHaveTextContent("20261001");
    expect(screen.getByTestId("legacy-notice")).toHaveTextContent("pre-publication legacy version");
  });

  it("uses fallback title and effectiveDate when published content has no usable title", async () => {
    getPublishedLegalDocument.mockResolvedValue(
      published(
        {
          title: "   ",
          effectiveDate: "Fallback date",
          section1: { content: "Body" },
        },
        { effectiveAt: null },
      ),
    );

    render(<PublishedLegalDocument documentType="privacy" title="Privacy fallback" />);

    expect(await screen.findByText("Body")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy fallback");
    expect(screen.getByTestId("effective-date")).toHaveTextContent("Fallback date");
  });

  it("shows unavailable state when the API fails", async () => {
    getPublishedLegalDocument.mockRejectedValue(new Error("offline"));

    render(<PublishedLegalDocument documentType="cookie" title="Cookie policy" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Document unavailable.");
  });

  it("shows unavailable state when legacy bundle is not an object", async () => {
    i18nState.bundle = [];
    getPublishedLegalDocument.mockResolvedValue(
      published(null as never, {
        legacyWithoutSnapshot: true,
        content: null,
        effectiveAt: null,
      }),
    );

    render(<PublishedLegalDocument documentType="terms" title="Terms" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Document unavailable.");
  });

  it("does not update state after unmounting while publication is pending", async () => {
    let resolvePublication: (value: unknown) => void = () => undefined;
    getPublishedLegalDocument.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePublication = resolve;
        }),
    );

    const view = render(<PublishedLegalDocument documentType="terms" title="Terms" />);
    view.unmount();
    resolvePublication(published({ intro: "late" }));

    await Promise.resolve();
    expect(ensureLegalTranslationsLoaded).not.toHaveBeenCalled();
  });

  it("does not consume a legacy bundle after unmounting during translation loading", async () => {
    let resolveTranslations: () => void = () => undefined;
    ensureLegalTranslationsLoaded.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveTranslations = resolve;
        }),
    );
    getPublishedLegalDocument.mockResolvedValue(
      published(null as never, { legacyWithoutSnapshot: true, content: null }),
    );

    const view = render(<PublishedLegalDocument documentType="terms" title="Terms" />);
    await waitFor(() => expect(ensureLegalTranslationsLoaded).toHaveBeenCalled());
    view.unmount();
    resolveTranslations();

    await Promise.resolve();
    expect(screen.queryByText("Legacy content")).not.toBeInTheDocument();
  });
});
