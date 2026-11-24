/**
 * Deferred, subsetted font loading.
 * Public routes (login) load Inter woff2 subsets only. Authenticated routes add Roboto Flex.
 * unicode-range keeps English login on the latin file (~48KB) instead of full variable TTFs.
 * font-display: optional prevents a late Inter swap from becoming the LCP timestamp.
 *
 * Faces are registered with the CSS Font Loading API (`new FontFace` +
 * `document.fonts.add`) rather than an injected `<style>`: the production CSP
 * only allows the `<style>` bodies hashed at SSR time, so a style element
 * created in the browser is blocked and no font ever loads (issue 650). FontFace
 * objects are governed by `font-src 'self'`. Faces added this way still load
 * lazily: the browser fetches a subset only when text in its unicode-range
 * renders.
 */

import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interLatinExt from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url";
import interGreek from "@fontsource-variable/inter/files/inter-greek-wght-normal.woff2?url";
import {
  GREEK_RANGE,
  LATIN_EXT_RANGE,
  LATIN_RANGE,
  type FontFaceDefinition,
} from "./fontFaceDefinitions.js";

export type { FontFaceDefinition } from "./fontFaceDefinitions.js";

/**
 * Marker elements: a `<meta>` per font group (CSP-neutral, no inline style).
 * They make registration idempotent and let the visual-regression harness read
 * the exact font URLs the app registered.
 */
export const PUBLIC_FONT_MARKER_ID = "async-fonts";
export const APP_FONT_MARKER_ID = "async-fonts-app";

const interFace = (url: string, unicodeRange: string): FontFaceDefinition => ({
  family: "Inter",
  url,
  unicodeRange,
  weight: "100 900",
  display: "optional",
});

export const PUBLIC_FONT_FACES: readonly FontFaceDefinition[] = [
  interFace(interLatin, LATIN_RANGE),
  interFace(interLatinExt, LATIN_EXT_RANGE),
  interFace(interGreek, GREEK_RANGE),
];

const canRegisterFonts = (): boolean =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  typeof FontFace !== "undefined" &&
  Boolean(document.fonts);

const registerFaces = (markerId: string, faces: readonly FontFaceDefinition[]): void => {
  if (!canRegisterFonts() || document.getElementById(markerId)) {
    return;
  }
  for (const face of faces) {
    document.fonts.add(
      new FontFace(face.family, `url("${face.url}") format("woff2-variations")`, {
        style: "normal",
        weight: face.weight,
        display: face.display,
        unicodeRange: face.unicodeRange,
      }),
    );
  }
  const marker = document.createElement("meta");
  marker.id = markerId;
  marker.name = "fitvibe:font-faces";
  marker.content = JSON.stringify(faces);
  document.head.appendChild(marker);
  requestAnimationFrame(() => {
    document.body.classList.add("fonts-loaded");
  });
};

const runWhenIdle = (task: () => void): void => {
  if (typeof window === "undefined") {
    return;
  }
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout: 3000 });
    return;
  }
  setTimeout(task, 2000);
};

/**
 * Inter subsets for login and other public pages. Does not load Roboto Flex.
 */
export const loadPublicFonts = (): void => {
  runWhenIdle(() => registerFaces(PUBLIC_FONT_MARKER_ID, PUBLIC_FONT_FACES));
};

/**
 * Roboto Flex heading font for authenticated chrome. Loaded in a separate chunk.
 */
export const loadAppFonts = (): void => {
  runWhenIdle(() => {
    void import("./appFontLoader.js").then(({ APP_FONT_FACES }) => {
      registerFaces(APP_FONT_MARKER_ID, APP_FONT_FACES);
    });
  });
};

/** @deprecated Use loadPublicFonts — kept as the bootstrap entry alias. */
export const loadFontsAsync = loadPublicFonts;
