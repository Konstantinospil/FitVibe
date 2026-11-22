import { afterEach, describe, expect, it } from "vitest";
import { registerInlinedStylesheets } from "../../src/ssr/registerInlinedStylesheets";

const addInlineStyle = (href: string) => {
  const style = document.createElement("style");
  style.dataset.href = href;
  style.textContent = "p{margin:0}";
  document.head.appendChild(style);
};

const stylesheetLinks = () =>
  Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));

// #634: Vite's dynamic-import preload helper re-downloads CSS that SSR already
// inlined unless an equivalent <link rel="stylesheet"> is on the page.
describe("registerInlinedStylesheets", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("registers each inlined asset stylesheet as a disabled link", () => {
    addInlineStyle("/assets/css/main-abc.css");
    addInlineStyle("/assets/css/CookieConsent-def.css");

    expect(registerInlinedStylesheets()).toBe(2);

    const links = stylesheetLinks();
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/assets/css/main-abc.css",
      "/assets/css/CookieConsent-def.css",
    ]);
    // Disabled: never fetched or applied, so the inline <style> stays the only copy.
    for (const link of links) {
      expect(link.hasAttribute("disabled")).toBe(true);
      expect(link.dataset.inlined).toBe("true");
    }
  });

  it("is idempotent and skips stylesheets that already have a link", () => {
    addInlineStyle("/assets/css/main-abc.css");
    const existing = document.createElement("link");
    existing.rel = "stylesheet";
    existing.setAttribute("href", "/assets/css/main-abc.css");
    document.head.appendChild(existing);

    expect(registerInlinedStylesheets()).toBe(0);
    expect(registerInlinedStylesheets()).toBe(0);
    expect(stylesheetLinks()).toHaveLength(1);
  });

  it("ignores anything that is not a same-origin built CSS asset", () => {
    for (const href of [
      "https://evil.example/assets/css/x.css",
      "//evil.example/assets/css/x.css",
      "/assets/css/../../secrets.css",
      "/assets/js/main.js",
      "/other/x.css",
      "javascript:alert(1)",
      "",
    ]) {
      addInlineStyle(href);
    }

    expect(registerInlinedStylesheets()).toBe(0);
    expect(stylesheetLinks()).toHaveLength(0);
  });

  it("does nothing on pages without inlined styles", () => {
    expect(registerInlinedStylesheets()).toBe(0);
  });
});
