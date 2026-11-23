import { describe, expect, it } from "vitest";
import { INLINE_ASSET_LIMIT_BYTES, shouldInlineAsset } from "../../../apps/frontend/vite.config";

// #634 H13: fonts must stay separate files so unicode-range subsets are only
// fetched when needed. The Greek Roboto Flex subset (11 KB) had been inlined
// into the authenticated font-loader chunk and downloaded on every page.
describe("asset inlining", () => {
  const small = Buffer.alloc(1024);
  const large = Buffer.alloc(INLINE_ASSET_LIMIT_BYTES + 1);

  it("never inlines font files, however small", () => {
    for (const file of [
      "/x/@fontsource-variable/roboto-flex/files/roboto-flex-greek-wght-normal.woff2",
      "/x/font.woff",
      "/x/font.ttf",
      "/x/font.otf",
      "/x/font.eot",
      "/x/font.woff2?url",
      "/x/FONT.WOFF2",
    ]) {
      expect(shouldInlineAsset(file, small), file).toBe(false);
    }
  });

  it("keeps the size limit for every other asset", () => {
    expect(shouldInlineAsset("/x/icon.svg", small)).toBe(true);
    expect(shouldInlineAsset("/x/photo.png", small)).toBe(true);
    expect(shouldInlineAsset("/x/photo.png", large)).toBe(false);
  });
});
