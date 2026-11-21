import { createHash } from "node:crypto";
import { inlineElementBodies } from "./inlineCsp.js";

const hashSource = (source: string): string =>
  `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;

/**
 * A strict script allow-list: SSR is expected to emit exactly the canonical
 * first-paint theme bootstrap. Hashing arbitrary inline scripts in the rendered
 * response would grant execution permission to unexpected injected markup.
 *
 * CSS is emitted by the trusted SSR template and stylesheet inliner; hash the
 * exact serialized text so the browser can apply styles without unsafe-inline.
 */
export function contentSecurityPolicyForHtml(
  html: string,
  canonicalThemeBootstrap: string,
): string {
  const inlineScripts = inlineElementBodies(html, "script")
    .filter((source) => source.trim().length > 0);
  if (inlineScripts.length !== 1 || inlineScripts[0] !== canonicalThemeBootstrap) {
    throw new Error("SSR contains unexpected or missing inline JavaScript");
  }

  const scriptHash = hashSource(canonicalThemeBootstrap);
  const styleHashes = [...new Set(inlineElementBodies(html, "style").map(hashSource))];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `script-src 'self' ${scriptHash}`,
    "script-src-attr 'none'",
    `style-src 'self'${styleHashes.length ? ` ${styleHashes.join(" ")}` : ""}`,
    "style-src-attr 'unsafe-inline'",
  ].join("; ");
}
