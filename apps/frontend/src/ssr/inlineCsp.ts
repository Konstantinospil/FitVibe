/**
 * Extract script/style raw text from the HTML emitted by FitVibe SSR.
 *
 * This is intentionally a small scanner for our trusted generated HTML, not an
 * HTML sanitizer. Opening tags are traversed with quote-aware boundaries;
 * script/style bodies are raw text until an HTML end tag. Missing boundaries
 * fail closed instead of producing a partial CSP allow-list.
 */
export function inlineElementBodies(html: string, kind: "script" | "style"): string[] {
  const htmlWhitespace = new Set([" ", "\t", "\n", "\r", "\f"]);
  const whitespace = (char: string | undefined) =>
    char !== undefined && htmlWhitespace.has(char);
  const boundary = (char: string | undefined) =>
    char === ">" || char === "/" || whitespace(char);

  const tagEnd = (start: number): number => {
    let quote: '"' | "'" | null = null;
    for (let i = start; i < html.length; i += 1) {
      const char = html[i];
      if (quote) {
        if (char === quote) {
          quote = null;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        return i;
      }
    }
    throw new Error("SSR HTML contains an unterminated tag");
  };

  const bodies: string[] = [];
  const lower = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const open = html.indexOf("<", cursor);
    if (open === -1) {
      break;
    }

    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      if (end === -1) {
        throw new Error("SSR HTML contains an unterminated comment");
      }
      cursor = end + 3;
      continue;
    }

    const nameStart = open + 1;
    const isTarget = lower.startsWith(kind, nameStart) && boundary(lower[nameStart + kind.length]);
    const end = tagEnd(nameStart);
    cursor = end + 1;
    if (!isTarget) {
      continue;
    }

    const textStart = cursor;
    let close = lower.indexOf("</" + kind, cursor);
    while (close !== -1 && !boundary(lower[close + kind.length + 2])) {
      close = lower.indexOf("</" + kind, close + 2);
    }
    if (close === -1) {
      throw new Error("SSR HTML contains an unclosed <" + kind + "> element");
    }
    const closeEnd = tagEnd(close + 2);
    bodies.push(html.slice(textStart, close));
    cursor = closeEnd + 1;
  }
  return bodies;
}
