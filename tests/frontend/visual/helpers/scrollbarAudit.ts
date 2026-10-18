import type { Page } from "@playwright/test";

/**
 * Fail closed on visible legacy scroll containers. A scrollbar is compliant only
 * when the scrolling viewport belongs to the shared CustomScrollbar component.
 * Run after route and modal content is fully rendered, and at every screenshot.
 */
export async function assertStandardScrollbars(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const findings: string[] = [];
    const describe = (element: Element): string => {
      const segments: string[] = [];
      let current: Element | null = element;
      for (let depth = 0; current && depth < 5; depth++, current = current.parentElement) {
        const id = current.id ? `#${current.id}` : "";
        const classes = [...current.classList].slice(0, 2).map((name) => `.${name}`).join("");
        segments.unshift(`${current.tagName.toLowerCase()}${id}${classes}`);
      }
      return segments.join(" > ");
    };

    for (const element of document.querySelectorAll<HTMLElement>("body, body *")) {
      if (element.closest("[hidden], [inert], [aria-hidden='true']")) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility !== "visible") continue;
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue;

      const verticallyScrollable = /^(auto|scroll|overlay)$/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const horizontallyScrollable = /^(auto|scroll|overlay)$/.test(style.overflowX) &&
        element.scrollWidth > element.clientWidth + 1;
      if (!verticallyScrollable && !horizontallyScrollable) continue;

      const shell = element.closest(".custom-scrollbar");
      const canonical = element.classList.contains("custom-scrollbar__viewport") &&
        shell !== null && shell.querySelector(":scope > .custom-scrollbar__track[role='scrollbar']") !== null;
      if (!canonical) {
        findings.push(`${describe(element)}: ${verticallyScrollable ? "vertical" : ""}${horizontallyScrollable ? " horizontal" : ""} overflow; no canonical scrollbar`);
      } else if (verticallyScrollable) {
        const track = shell!.querySelector<HTMLElement>(":scope > .custom-scrollbar__track");
        if (track?.dataset.scrollable !== "true") {
          const details = [
            `scrollHeight=${element.scrollHeight}`,
            `clientHeight=${element.clientHeight}`,
            `scrollTop=${element.scrollTop}`,
            `trackScrollable=${track?.dataset.scrollable ?? "missing"}`,
            `shellScrollable=${shell?.getAttribute("data-scrollable") ?? "missing"}`,
            `trackVisible=${track ? getComputedStyle(track).visibility : "missing"}`,
          ].join(", ");
          findings.push(`${describe(element)}: canonical track does not reflect overflow (${details})`);
        }
      }
    }

    // The document uses ordinary browser scrolling. Only dedicated content
    // panels with the shared component are required to have a custom track.
    return findings;
  });
  if (violations.length) {
    throw new Error(
      `Legacy scrollbar audit found ${violations.length} violation(s) on ${page.url()}:\n` +
        violations.map((finding) => `- ${finding}`).join("\n"),
    );
  }
}
