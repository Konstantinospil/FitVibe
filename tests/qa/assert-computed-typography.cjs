"use strict";

const assert = require("node:assert/strict");
const schema = require("../../design/typography.schema.json");

const firstFamily = (stack) => stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
const approximate = (actual, expected, label) => {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) < 0.02,
    label + ": expected " + expected + "px, received " + actual + "px",
  );
};

/**
 * Measure actual browser CSS, not token source text or simulated values.
 * One authority supplies the expected Figma values for both applications.
 */
async function assertComputedTypography(page, expectedTheme) {
  const observed = await page.evaluate((roles) => {
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const bodyStyle = getComputedStyle(document.body);
    const heading = document.querySelector("h1");
    const samples = {};

    for (const role of Object.keys(roles)) {
      const probe = document.createElement("span");
      probe.className = "typography-" + role;
      probe.textContent = "FitVibe";
      document.body.appendChild(probe);
      try {
        const style = getComputedStyle(probe);
        samples[role] = {
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
        };
      } finally {
        probe.remove();
      }
    }

    const tokens = {};
    for (const token of [
      "--font-family-base",
      "--font-family-body",
      "--font-size-xs",
      "--type-supporting-size",
      "--font-size-md",
      "--type-body-size",
      "--line-height-normal",
      "--type-body-line-height",
      "--letter-spacing-tight",
      "--type-page-title-letter-spacing",
    ]) {
      tokens[token] = rootStyle.getPropertyValue(token).trim();
    }

    return {
      width: window.innerWidth,
      theme: root.getAttribute("data-theme"),
      rootFamily: rootStyle.fontFamily,
      bodyFamily: bodyStyle.fontFamily,
      headingFamily: heading ? getComputedStyle(heading).fontFamily : null,
      tokens,
      samples,
    };
  }, schema.roles);

  assert.equal(observed.theme, expectedTheme, "The application must actually apply the requested theme");
  const mobile = observed.width <= schema.mobileBreakpointPx;
  const mode = mobile ? "mobile" : "desktop";

  for (const [role, properties] of Object.entries(schema.roles)) {
    const [family, weight, desktopSize, desktopLine, spacing, mobileSize, mobileLine] = properties;
    const actual = observed.samples[role];
    assert.ok(actual, "Missing computed sample for " + role);
    const label = role + " (" + mode + ", " + expectedTheme + ", " + observed.width + "px)";
    assert.equal(firstFamily(actual.fontFamily), family, label + " font family");
    assert.equal(Number(actual.fontWeight), weight, label + " font weight");
    const fontSize = mobile ? mobileSize : desktopSize;
    approximate(parseFloat(actual.fontSize), fontSize, label + " font size");
    approximate(parseFloat(actual.lineHeight), mobile ? mobileLine : desktopLine, label + " line height");
    const actualSpacing = actual.letterSpacing === "normal" ? 0 : parseFloat(actual.letterSpacing);
    approximate(actualSpacing, spacing * fontSize, label + " letter spacing");
  }

  for (const [alias, canonical] of [
    ["--font-family-base", "--font-family-body"],
    ["--font-size-xs", "--type-supporting-size"],
    ["--font-size-md", "--type-body-size"],
    ["--line-height-normal", "--type-body-line-height"],
    ["--letter-spacing-tight", "--type-page-title-letter-spacing"],
  ]) {
    assert.ok(observed.tokens[canonical], "Missing canonical token " + canonical);
    assert.equal(observed.tokens[alias], observed.tokens[canonical], "Unresolved or divergent alias " + alias);
  }
  assert.equal(firstFamily(observed.rootFamily), "Inter", "Root must use the shared body family");
  assert.equal(firstFamily(observed.bodyFamily), "Inter", "Body must use the shared body family");
  assert.ok(observed.headingFamily, "The rendered page must have a real h1 element");
  assert.equal(firstFamily(observed.headingFamily), "Roboto Flex", "The page heading must use the shared heading family");
}

module.exports = { assertComputedTypography };
