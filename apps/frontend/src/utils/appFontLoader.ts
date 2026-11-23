/**
 * Authenticated-app heading font. Split from fontLoader so /login does not download Roboto Flex.
 */

import robotoLatin from "@fontsource-variable/roboto-flex/files/roboto-flex-latin-wght-normal.woff2?url";
import robotoLatinExt from "@fontsource-variable/roboto-flex/files/roboto-flex-latin-ext-wght-normal.woff2?url";
import robotoGreek from "@fontsource-variable/roboto-flex/files/roboto-flex-greek-wght-normal.woff2?url";
import {
  GREEK_RANGE,
  LATIN_EXT_RANGE,
  LATIN_RANGE,
  type FontFaceDefinition,
} from "./fontFaceDefinitions.js";

const robotoFace = (url: string, unicodeRange: string): FontFaceDefinition => ({
  family: "Roboto Flex",
  url,
  unicodeRange,
  weight: "100 1000",
  display: "swap",
});

export const APP_FONT_FACES: readonly FontFaceDefinition[] = [
  robotoFace(robotoLatin, LATIN_RANGE),
  robotoFace(robotoLatinExt, LATIN_EXT_RANGE),
  robotoFace(robotoGreek, GREEK_RANGE),
];
