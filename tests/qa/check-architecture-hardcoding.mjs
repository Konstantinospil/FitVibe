#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const mode = process.argv[2] || "all";
const validModes = new Set(["all", "backend", "frontend-tokens", "frontend-reuse"]);

if (!validModes.has(mode)) {
  console.error("Usage: node tests/qa/check-architecture-hardcoding.mjs [all|backend|frontend-tokens|frontend-reuse]");
  process.exit(2);
}

const violations = [];

function normalize(file) {
  return file.split(path.sep).join("/");
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function report(file, source, index, message) {
  const line = lineNumber(source, index);
  const normalized = normalize(path.relative(ROOT, file));
  violations.push({ file: normalized, line, message });
  console.error("::error file=" + normalized + ",line=" + line + "::" + message);
  console.error("ARCHITECTURE_FINDING " + normalized + ":" + line + " " + message);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function sourceException(source, index, marker) {
  const line = lineNumber(source, index);
  const lines = source.split("\n");
  const candidates = [lines[line - 1] || "", lines[line - 2] || ""];
  if (marker === "policy") {
    return candidates.some((candidate) =>
      /architecture-policy:\s*implementation-constant\s*--\s*.{10,}/.test(candidate),
    );
  }
  if (marker === "token") {
    return candidates.some((candidate) =>
      /architecture-token:\s*data-value\s*--\s*.{10,}/.test(candidate),
    );
  }
  return false;
}

function productionTypeScript(file) {
  const normalized = normalize(file);
  return (
    /\.tsx?$/.test(normalized) &&
    !/\.(test|spec)\.tsx?$/.test(normalized) &&
    !normalized.includes("/__tests__/") &&
    !normalized.includes("/migrations/") &&
    !normalized.includes("/seeds/")
  );
}

async function checkBackend() {
  const canonicalRateLimiter = "apps/backend/src/middlewares/rate-limit.ts";
  const sensitivePolicyFiles = new Set([
    "apps/backend/src/modules/auth/passwordPolicy.ts",
    "apps/backend/src/modules/auth/timing.utils.ts",
    "apps/backend/src/modules/auth/two-factor.service.ts",
    "apps/backend/src/middlewares/rate-limit.ts",
    "apps/backend/src/modules/points/seasonal-events.service.ts",
    "apps/backend/src/modules/points/streaks.service.ts",
    "apps/backend/src/modules/points/badge-criteria.ts",
  ]);
  const files = [...sensitivePolicyFiles].map((relative) => path.join(ROOT, relative));

  const numericPolicyPattern =
    /\b(?:minLength|maxLength|minDurationMs|maxDurationMs|durationMs|durationSeconds|windowMs|windowSeconds|maxAttempts|attempts|backupCodeCount|backupCodeLength|bcryptRounds|rounds|lookbackDays|windowDays|threshold|bonus|multiplier|points|step|window)\s*[:=]\s*-?\d+(?:\.\d+)?\b/g;
  const dateLiteralPattern = /["']20\d{2}-\d{2}-\d{2}(?:T[^"']*)?["']/g;

  for (const file of files) {
    const rel = normalize(path.relative(ROOT, file));
    const source = await fs.readFile(file, "utf8");

    const envPattern = /\bprocess\.env\b/g;
    for (const match of source.matchAll(envPattern)) {
      report(
        file,
        source,
        match.index,
        "Audited policy surfaces must consume validated configuration authorities instead of process.env directly.",
      );
    }

    if (rel !== canonicalRateLimiter) {
      const rateLimiterImport = /from\s+["']express-rate-limit["']|require\(["']express-rate-limit["']\)/g;
      for (const match of source.matchAll(rateLimiterImport)) {
        report(
          file,
          source,
          match.index,
          "express-rate-limit may only be wired by the canonical rate-limit middleware.",
        );
      }
    }

    if (sensitivePolicyFiles.has(rel)) {
      for (const match of source.matchAll(numericPolicyPattern)) {
        if (!sourceException(source, match.index, "policy")) {
          report(
            file,
            source,
            match.index,
            "Security/product policy literals in sensitive services must come from a canonical authority. Narrow implementation constants require an architecture-policy comment with a concrete reason.",
          );
        }
      }

      if (rel.includes("/modules/points/")) {
        for (const match of source.matchAll(dateLiteralPattern)) {
          if (!sourceException(source, match.index, "policy")) {
            report(
              file,
              source,
              match.index,
              "Versioned gamification catalogue dates belong in persisted policy data, not service literals.",
            );
          }
        }
      }
    }
  }
}

async function frontendSourceFiles(extensions) {
  const roots = [
    path.join(ROOT, "apps/frontend/src"),
    path.join(ROOT, "apps/backoffice/src"),
  ];
  const files = [];
  for (const root of roots) {
    for (const file of await walk(root)) {
      const rel = normalize(path.relative(ROOT, file));
      if (
        extensions.some((extension) => rel.endsWith(extension)) &&
        !/\.(test|spec)\.[^.]+$/.test(rel) &&
        !rel.includes("/__tests__/")
      ) {
        files.push(file);
      }
    }
  }
  return files;
}

function lineTextAt(source, index) {
  const line = lineNumber(source, index);
  return source.split("\n")[line - 1] || "";
}

async function checkFrontendTokens() {
  const sourceFiles = await frontendSourceFiles([".ts", ".tsx", ".js", ".jsx"]);
  const stylesheetFiles = await frontendSourceFiles([".css", ".scss"]);
  const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\([^)]*\)|hsla?\s*\([^)]*\)/g;
  const figmaAuthorityDeclarations = new Map([
    ["--radius-sm", "8px"], ["--radius-md", "12px"], ["--radius-lg", "16px"],
    ["--radius-xl", "24px"], ["--radius-full", "999px"],
    ["--opacity-full", "1"], ["--opacity-subtle", "0.7"], ["--opacity-disabled", "0.45"],
    ["--transparency-full", "100%"], ["--transparency-subtle", "70%"], ["--transparency-disabled", "45%"],
    ["--font-weight-regular", "400"], ["--font-weight-control-large", "582"], ["--font-weight-semibold", "600"],
    ["--type-display-size", "3rem"], ["--type-display-line-height", "3.5rem"], ["--type-display-letter-spacing", "-0.01em"],
    ["--type-page-title-size", "2rem"], ["--type-page-title-line-height", "2.5rem"], ["--type-page-title-letter-spacing", "-0.005em"],
    ["--type-section-title-size", "1.5rem"], ["--type-section-title-line-height", "2rem"], ["--type-section-title-letter-spacing", "-0.005em"],
    ["--type-card-title-size", "1.125rem"], ["--type-card-title-line-height", "1.5rem"], ["--type-card-title-letter-spacing", "0"],
    ["--type-body-size", "1rem"], ["--type-body-line-height", "1.5rem"], ["--type-body-letter-spacing", "0"],
    ["--type-supporting-size", "0.875rem"], ["--type-supporting-line-height", "1.25rem"], ["--type-supporting-letter-spacing", "0"],
    ["--type-control-size", "0.875rem"], ["--type-control-line-height", "1.25rem"], ["--type-control-letter-spacing", "0"],
    ["--type-control-large-size", "1rem"], ["--type-control-large-line-height", "1.5rem"], ["--type-control-large-letter-spacing", "0"],
    ["--type-primary-metric-size", "2rem"], ["--type-primary-metric-line-height", "2.25rem"], ["--type-primary-metric-letter-spacing", "-0.005em"],
    ["--type-secondary-metric-size", "1.5rem"], ["--type-secondary-metric-line-height", "1.75rem"], ["--type-secondary-metric-letter-spacing", "-0.005em"],
    ["--type-metric-small-size", "0.875rem"], ["--type-metric-small-line-height", "0.75rem"], ["--type-metric-small-letter-spacing", "0.02em"],
  ]);


  const allowedRadiusValues = new Set(["8px", "12px", "16px", "24px", "999px", "0.5rem", "0.75rem", "1rem", "1.5rem"]);
  const allowedOpacityValues = new Set(["1", "0.7", "0.70", "0.45"]);
  const allowedFontSizes = new Set(["14px", "16px", "18px", "24px", "32px", "48px", "0.875rem", "1rem", "1.125rem", "1.5rem", "2rem", "3rem"]);
  const allowedLineHeights = new Set(["12px", "20px", "24px", "28px", "32px", "36px", "40px", "56px", "0.75rem", "1.25rem", "1.5rem", "1.75rem", "2rem", "2.25rem", "2.5rem", "3.5rem"]);
  const allowedLetterSpacing = new Set(["0", "0em", "0%", "-0.005em", "-0.01em", "-0.5%", "-1%", "0.02em", "2%"]);
  const allowedFontWeights = new Set(["400", "582", "600", "normal"]);
  const allowedFontFamilies = new Set(["Inter", "Roboto Flex", "inherit"]);

  const sourceDesignPatterns = [
    {
      pattern: /\bborderRadius\s*:\s*["'`]\s*([^"'`]+)\s*["'`]/g,
      allowed: allowedRadiusValues,
      message: "Raw radius outside the Figma radius authority (8/12/16/24/999px).",
    },
    {
      pattern: /\bopacity\s*:\s*(0(?:\.\d+)?|1(?:\.0+)?)\b/g,
      allowed: allowedOpacityValues,
      message: "Opacity outside the Figma authority (100%/70%/45%).",
    },
    {
      pattern: /\bfontSize\s*:\s*["'`]([^"'`]+)["'`]/g,
      allowed: allowedFontSizes,
      message: "Font size outside the Figma typography authority.",
    },
    {
      pattern: /\blineHeight\s*:\s*["'`]([^"'`]+)["'`]/g,
      allowed: allowedLineHeights,
      message: "Line height outside the Figma typography authority.",
    },
    {
      pattern: /\bletterSpacing\s*:\s*["'`]([^"'`]+)["'`]/g,
      allowed: allowedLetterSpacing,
      message: "Letter spacing outside the Figma typography authority.",
    },
    {
      pattern: /\bfontWeight\s*:\s*["'`]?(\d+|normal|bold)["'`]?/g,
      allowed: allowedFontWeights,
      message: "Font weight outside the Figma typography authority (400/582/600).",
    },
    {
      pattern: /\bfontFamily\s*:\s*["'`]([^"'`]+)["'`]/g,
      allowed: allowedFontFamilies,
      message: "Font family outside the Figma authority (Inter/Roboto Flex).",
    },
  ];

  for (const file of sourceFiles) {
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(rawColorPattern)) {
      if (!sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "Raw color literal in production frontend source. Consume a design token; true data-value colors require a narrow architecture-token comment with a concrete reason.",
        );
      }
    }

    for (const rule of sourceDesignPatterns) {
      for (const match of source.matchAll(rule.pattern)) {
        const value = String(match[1] ?? "").trim();
        if (!rule.allowed.has(value) && !sourceException(source, match.index, "token")) {
          report(file, source, match.index, rule.message);
        }
      }
    }
  }

  for (const file of stylesheetFiles) {
    const source = await fs.readFile(file, "utf8");
    const rel = normalize(path.relative(ROOT, file));
    if (rel.endsWith("/styles/global.css")) {
      for (const [token, expected] of figmaAuthorityDeclarations) {
        if (!source.includes(token + ": " + expected + ";")) {
          report(file, source, 0, "Figma design authority drift: " + token + " must equal " + expected + ".");
        }
      }
    }

    const rawAlphaPattern = /rgba?\([^)]*?,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)/g;
    for (const match of source.matchAll(rawAlphaPattern)) {
      const alpha = Number(match[1]);
      if (![1, 0.7, 0.45].includes(alpha)) {
        report(file, source, match.index, "Transparency must use only Figma opacity levels: 100%, 70%, or 45%.");
      }
    }

    const rawColorMixTransparency = /color-mix\([^)]*?\s(\d+(?:\.\d+)?)%,\s*transparent\)/g;
    for (const match of source.matchAll(rawColorMixTransparency)) {
      const percent = Number(match[1]);
      if (![100, 70, 45].includes(percent)) {
        report(file, source, match.index, "color-mix transparency must use a Figma transparency token (100%, 70%, or 45%).");
      }
    }

    const cssDesignPatterns = [
      {
        pattern: /\bborder-radius\s*:\s*([^;]+);/g,
        allowed: allowedRadiusValues,
        variablePrefix: "--radius-",
        message: "CSS border-radius outside the Figma radius authority.",
      },
      {
        pattern: /\bopacity\s*:\s*([^;]+);/g,
        allowed: allowedOpacityValues,
        variablePrefix: "--opacity-",
        message: "CSS opacity outside the Figma opacity authority.",
      },
      {
        pattern: /\bfont-size\s*:\s*([^;]+);/g,
        allowed: allowedFontSizes,
        variablePrefix: "--type-",
        compatibilityPrefix: "--font-size-",
        message: "CSS font-size outside the Figma typography authority.",
      },
      {
        pattern: /\bline-height\s*:\s*([^;]+);/g,
        allowed: allowedLineHeights,
        variablePrefix: "--type-",
        compatibilityPrefix: "--line-height-",
        message: "CSS line-height outside the Figma typography authority.",
      },
      {
        pattern: /\bletter-spacing\s*:\s*([^;]+);/g,
        allowed: allowedLetterSpacing,
        variablePrefix: "--type-",
        compatibilityPrefix: "--letter-spacing-",
        message: "CSS letter-spacing outside the Figma typography authority.",
      },
      {
        pattern: /\bfont-weight\s*:\s*([^;]+);/g,
        allowed: allowedFontWeights,
        variablePrefix: "--font-weight-",
        message: "CSS font-weight outside the Figma typography authority.",
      },
      {
        pattern: /\bfont-family\s*:\s*([^;]+);/g,
        allowed: new Set(["Inter", "Roboto Flex", "inherit"]),
        variablePrefix: "--font-family-",
        message: "CSS font-family outside the Figma typography authority.",
      },
    ];

    for (const match of source.matchAll(rawColorPattern)) {
      const line = lineTextAt(source, match.index);
      const isTokenDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
      if (!isTokenDeclaration && !sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "Raw color literal outside a CSS custom-property token declaration. Consume a canonical token instead.",
        );
      }
    }

    for (const rule of cssDesignPatterns) {
      for (const match of source.matchAll(rule.pattern)) {
        const line = lineTextAt(source, match.index);
        const value = String(match[1] ?? "").trim().replace(/^["']|["']$/g, "");
        const isAuthorityDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
        const isTokenReference =
          value.startsWith("var(" + rule.variablePrefix) ||
          (rule.compatibilityPrefix && value.startsWith("var(" + rule.compatibilityPrefix));
        const plainFamily = value.split(",")[0].trim().replace(/^["']|["']$/g, "");
        const allowed =
          rule.allowed.has(value) ||
          rule.allowed.has(plainFamily) ||
          isTokenReference ||
          isAuthorityDeclaration;
        if (!allowed && !sourceException(source, match.index, "token")) {
          report(file, source, match.index, rule.message);
        }
      }
    }
  }
}

function rawTagType(tag) {
  const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
  return typeMatch ? typeMatch[1].toLowerCase() : "text";
}

async function checkFrontendReuse() {
  const allSourceFiles = await frontendSourceFiles([".tsx"]);
  const pageFiles = allSourceFiles.filter((file) =>
    normalize(path.relative(ROOT, file)).includes("/pages/"),
  );

  const nativeInputTypes = new Set(["checkbox", "radio", "range", "file", "hidden", "color"]);
  const allowedNativeButtons = new Map([
    [
      "apps/backoffice/src/pages/Translations.tsx",
      new Set(["table-cell-disclosure"]),
    ],
  ]);

  for (const file of pageFiles) {
    const rel = normalize(path.relative(ROOT, file));
    const source = await fs.readFile(file, "utf8");
    const tagPattern = /<(button|select|textarea|input)\b[\s\S]*?>/g;

    for (const match of source.matchAll(tagPattern)) {
      const tagName = match[1].toLowerCase();
      const tag = match[0];

      if (tagName === "input" && nativeInputTypes.has(rawTagType(tag))) {
        continue;
      }

      if (tagName === "button") {
        const exception = tag.match(/\bdata-native-ui\s*=\s*["']([^"']+)["']/);
        if (
          exception &&
          allowedNativeButtons.get(rel) &&
          allowedNativeButtons.get(rel).has(exception[1])
        ) {
          continue;
        }
      }

      report(
        file,
        source,
        match.index,
        "Feature pages must consume canonical UI primitives. Native checkboxes/radio/range/file/hidden/color inputs are allowed; other native controls require a narrowly enumerated architectural exception.",
      );
    }
  }
}

const startCount = violations.length;

if (mode === "all" || mode === "backend") {
  await checkBackend();
}
if (mode === "all" || mode === "frontend-tokens") {
  await checkFrontendTokens();
}
if (mode === "all" || mode === "frontend-reuse") {
  await checkFrontendReuse();
}

const count = violations.length - startCount;
if (count > 0) {
  console.error("Architecture & Hardcoding check failed with " + count + " violation(s).");
  process.exit(1);
}

console.log("Architecture & Hardcoding check passed: " + mode);
