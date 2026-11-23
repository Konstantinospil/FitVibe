import { describe, expect, it } from "vitest";
import { APP_FONT_FACES } from "../../src/utils/appFontLoader";

describe("appFontLoader", () => {
  it("exports Roboto Flex faces for latin, latin-ext, and greek", () => {
    expect(APP_FONT_FACES).toHaveLength(3);
    for (const face of APP_FONT_FACES) {
      expect(face.family).toBe("Roboto Flex");
      expect(face.display).toBe("optional");
      expect(face.weight).toBe("100 1000");
      expect(face.url).toMatch(/\.woff2$/);
    }
    const ranges = APP_FONT_FACES.map((face) => face.unicodeRange);
    expect(ranges.some((range) => range.startsWith("U+0000-00FF"))).toBe(true);
    expect(ranges.some((range) => range.startsWith("U+0100-02BA"))).toBe(true);
    expect(ranges.some((range) => range.startsWith("U+0370-0377"))).toBe(true);
  });
});
