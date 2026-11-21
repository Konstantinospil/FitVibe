import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inlineElementBodies } from "../../../apps/frontend/src/ssr/inlineCsp";
import { contentSecurityPolicyForHtml } from "../../../apps/frontend/src/ssr/contentSecurityPolicy";

const bootstrap = "window.__fitvibeTheme = 'dark';";
const hash = (source: string) =>
  `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;

const documentWith = (scriptClose = "</script>", extra = "") =>
  `<!doctype html><html><head><style data-href="/assets/main.css">.a{color:red}</style></head><body>` +
  `<script data-title="a > b">${bootstrap}${scriptClose}` +
  `<script type="module" src="/assets/main.js"></script>${extra}</body></html>`;

describe("inline SSR element extraction", () => {
  it("recognizes HTML closing tags with whitespace and mixed case", () => {
    for (const closing of ["</script>", "</script >", "</SCRIPT\t>", "</ScRiPt\n>"]) {
      expect(inlineElementBodies(documentWith(closing), "script")).toEqual([bootstrap, ""]);
    }
  });

  it("handles quoted greater-than signs and unrelated markup", () => {
    const html = `<!-- <script>fake</script> --><div title="a > b">hello</div>` +
      `<script data-text="> and <">${bootstrap}</script>`;
    expect(inlineElementBodies(html, "script")).toEqual([bootstrap]);
  });

  it("treats style elements with closing-tag whitespace as browser-visible content", () => {
    expect(inlineElementBodies('<style type="text/css">a{color:blue}</style >', "style"))
      .toEqual(["a{color:blue}"]);
  });

  it("fails closed on malformed markup", () => {
    expect(() => inlineElementBodies("<script>without an end", "script")).toThrow(/unclosed/);
    expect(() => inlineElementBodies("<script title='unclosed>", "script")).toThrow(/unterminated/);
    expect(() => inlineElementBodies("<!-- unfinished", "style")).toThrow(/unterminated/);
  });
});

describe("SSR HTML CSP", () => {
  it("hashes the exact trusted script and CSS, preserving external modules", () => {
    const policy = contentSecurityPolicyForHtml(documentWith("</script >"), bootstrap);
    expect(policy).toContain(`script-src 'self' ${hash(bootstrap)}`);
    expect(policy).toContain(`style-src 'self' ${hash(".a{color:red}")}`);
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy).not.toContain(hash(""));
  });

  it("rejects arbitrary inline JavaScript instead of granting it an execution hash", () => {
    expect(() => contentSecurityPolicyForHtml(
      documentWith("</script>", "<script>evil()</script>"), bootstrap,
    )).toThrow(/unexpected or missing/);
  });

  it("rejects modified or missing bootstrap text and duplicate bootstraps", () => {
    expect(() => contentSecurityPolicyForHtml(documentWith().replace(bootstrap, "evil()"), bootstrap))
      .toThrow(/unexpected or missing/);
    expect(() => contentSecurityPolicyForHtml("<html><body></body></html>", bootstrap))
      .toThrow(/unexpected or missing/);
    expect(() => contentSecurityPolicyForHtml(
      documentWith("</script>", `<script>${bootstrap}</script>`), bootstrap,
    )).toThrow(/unexpected or missing/);
  });

  it("deduplicates equal CSS hashes but keeps distinct styles", () => {
    const html = documentWith("</script>", "<style>.a{color:red}</style><style>b{color:blue}</style>");
    const policy = contentSecurityPolicyForHtml(html, bootstrap);
    expect(policy.split(hash(".a{color:red}"))).toHaveLength(2);
    expect(policy).toContain(hash("b{color:blue}"));
  });
});
