/**
 * SSR inlines the entry's CSS as `<style data-href="/assets/css/…">` so the
 * first paint does not wait for a stylesheet request (see ssr/inlineStyles.ts).
 *
 * Vite's dynamic-import preload helper only recognises CSS that is already on
 * the page as a `<link rel="stylesheet">`. Without one, every lazy route or page
 * import downloads those same files again and waits for them before running
 * the imported module, which puts duplicate requests on the critical path of
 * every route (issue 634).
 *
 * Registering each inlined file as a *disabled* stylesheet link tells the
 * helper it is present. A link created from script with `disabled` set before
 * `href` is neither fetched nor applied, so styling is unchanged: the inline
 * `<style>` remains the only copy in effect.
 */
const INLINED_STYLE_SELECTOR = "style[data-href]";
const ASSET_CSS_PATH = /^\/assets\/[\w./-]+\.css$/;

export function registerInlinedStylesheets(doc: Document = document): number {
  const existing = new Set(
    Array.from(doc.getElementsByTagName("link"))
      .filter((link) => link.rel === "stylesheet")
      .map((link) => link.getAttribute("href")),
  );
  let registered = 0;
  for (const style of Array.from(doc.querySelectorAll<HTMLStyleElement>(INLINED_STYLE_SELECTOR))) {
    const href = style.dataset.href;
    // Only same-origin built CSS assets written by the SSR template qualify.
    if (!href || !ASSET_CSS_PATH.test(href) || href.includes("..") || existing.has(href)) {
      continue;
    }
    const link = doc.createElement("link");
    // Order matters: disabled before rel/href, so no fetch is ever started.
    link.setAttribute("disabled", "");
    link.rel = "stylesheet";
    link.setAttribute("data-inlined", "true");
    link.setAttribute("href", href);
    doc.head.appendChild(link);
    existing.add(href);
    registered += 1;
  }
  return registered;
}
