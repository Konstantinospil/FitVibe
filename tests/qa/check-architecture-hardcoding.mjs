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
    path.join(ROOT, "packages/ui/src"),
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

function insideFontFaceBlock(source, index) {
  const prefix = source.slice(0, index);
  const start = prefix.lastIndexOf("@font-face");
  if (start < 0) return false;
  const open = source.indexOf("{", start);
  if (open < 0 || open > index) return false;
  const close = source.indexOf("}", open);
  return close < 0 || index < close;
}

async function checkFrontendTokens() {
  const sourceFiles = await frontendSourceFiles([".ts", ".tsx", ".js", ".jsx"]);
  const stylesheetFiles = await frontendSourceFiles([".css", ".scss"]);
  const rawColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\([^)]*\)|hsla?\s*\([^)]*\)/g;
  const namedColorPattern =
    /\b(?:color|background|backgroundColor|borderColor|outlineColor|textDecorationColor|fill|stroke)\s*:\s*["'`](?:white|black|red|blue|green|gray|grey|yellow|orange|purple|pink)["'`]/gi;
  const namedCssColorPattern =
    /\b(?:color|background(?:-color)?|border(?:-[a-z-]+)?-color|outline-color|fill|stroke)\s*:\s*(?:white|black|red|blue|green|gray|grey|yellow|orange|purple|pink)\b/gi;
  const figmaAuthorityDeclarations = new Map([
    ["--radius-sm", "8px"], ["--radius-md", "12px"], ["--radius-lg", "16px"],
    ["--radius-xl", "24px"], ["--radius-full", "999px"], ["--radius-none", "0"],
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


  const visualAuthorityFiles = new Set([
    "apps/frontend/src/styles/global.css",
    "apps/backoffice/src/styles/global.css",
  ]);
  const literalTokenFallbackPattern =
    /var\(--[a-zA-Z0-9_-]+,\s*(?:#[0-9a-fA-F]{3,8}\b|rgba?\s*\([^)]*\)|hsla?\s*\([^)]*\)|(?:white|black|red|blue|green|gray|grey|yellow|orange|purple|pink)\b|-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)?\b)/gi;

  const arbitraryVisualUtilityPattern =
    /\b(?:rounded|opacity|text|leading|tracking|font)-\[[^\]]+\]/g;

  const sourceDesignPatterns = [
    {
      pattern: /\bborderRadius\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--radius-") || value.includes("var(--card-radius"),
      message: "Frontend radius must reference the canonical Figma radius token authority; manual values are forbidden.",
    },
    {
      pattern: /\bopacity\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--opacity-"),
      message: "Frontend opacity must reference a canonical Figma opacity token; manual values are forbidden.",
    },
    {
      pattern: /\bfontSize\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--type-") || value.includes("var(--font-size-"),
      message: "Frontend font size must reference a canonical Figma typography token; manual values are forbidden.",
    },
    {
      pattern: /\blineHeight\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--type-") || value.includes("var(--line-height-"),
      message: "Frontend line height must reference a canonical Figma typography token; manual values are forbidden.",
    },
    {
      pattern: /\bletterSpacing\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--type-") || value.includes("var(--letter-spacing-"),
      message: "Frontend letter spacing must reference a canonical Figma typography token; manual values are forbidden.",
    },
    {
      pattern: /\bfontWeight\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--font-weight-"),
      message: "Frontend font weight must reference a canonical Figma typography token; manual values are forbidden.",
    },
    {
      pattern: /\bfontFamily\s*:\s*([^,}\n]+)/g,
      allowedValue: (value) => value.includes("var(--font-family-"),
      message: "Frontend font family must reference the canonical Figma font-family authority; manual values are forbidden.",
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

    for (const match of source.matchAll(namedColorPattern)) {
      if (!sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "Named color literal in production frontend source. Consume a canonical design token instead.",
        );
      }
    }

    for (const match of source.matchAll(literalTokenFallbackPattern)) {
      if (!sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "CSS variable fallbacks must reference another semantic token; literal visual fallbacks bypass the design authority.",
        );
      }
    }

    for (const match of source.matchAll(arbitraryVisualUtilityPattern)) {
      if (!sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "Arbitrary visual utility values bypass the Figma authority. Use a canonical token-backed primitive or semantic class instead.",
        );
      }
    }

    for (const rule of sourceDesignPatterns) {
      for (const match of source.matchAll(rule.pattern)) {
        const value = String(match[1] ?? "").trim().replace(/^["'`]|["'`]$/g, "");
        const commaIndex = source.indexOf(",", match.index);
        const braceIndex = source.indexOf("}", match.index);
        const expressionEnd =
          commaIndex >= 0 && (braceIndex < 0 || commaIndex < braceIndex) ? commaIndex : braceIndex;
        const formattedExpression =
          expressionEnd >= 0 ? source.slice(match.index, expressionEnd) : match[0];

        const rawExpression = String(match[1] ?? "").trim();
        const directLiteral =
          /^(?:["'`]|-?\d)/.test(rawExpression) ||
          /\b(?:calc|clamp|min|max)\s*\(/.test(rawExpression);
        if (
          directLiteral &&
          !rule.allowedValue(value) &&
          !rule.allowedValue(formattedExpression) &&
          !sourceException(source, match.index, "token")
        ) {
          report(file, source, match.index, rule.message);
        }
      }
    }
  }

  for (const file of stylesheetFiles) {
    const source = await fs.readFile(file, "utf8");
    const rel = normalize(path.relative(ROOT, file));
    if (visualAuthorityFiles.has(rel)) {
      for (const [token, expected] of figmaAuthorityDeclarations) {
        if (!source.includes(token + ": " + expected + ";")) {
          report(file, source, 0, "Figma design authority drift: " + token + " must equal " + expected + ".");
        }
      }
      if (!source.includes("--textarea-min-height: 10rem;")) {
        report(file, source, 0, "Shared UI dimension authority drift: --textarea-min-height must equal 10rem.");
      }
      if (rel === "apps/frontend/src/styles/global.css") {
        for (const [token, expected] of [
          ["--modal-width-sm", "28rem"],
          ["--modal-width-md", "40rem"],
          ["--modal-width-lg", "56rem"],
        ]) {
          if (!source.includes(token + ": " + expected + ";")) {
            report(file, source, 0, "Frontend modal dimension authority drift: " + token + " must equal " + expected + ".");
          }
        }
      }
    }

    const isAuthorityFile = visualAuthorityFiles.has(rel);
    const customPropertyPattern = /^\s*(--[a-zA-Z0-9_-]+)\s*:/gm;
    if (!isAuthorityFile) {
      for (const match of source.matchAll(customPropertyPattern)) {
        report(
          file,
          source,
          match.index,
          "CSS custom-property declarations are restricted to explicit visual authority files; consumers must reference canonical tokens.",
        );
      }
    }

    const rawAlphaPattern = /rgba?\([^)]*?,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)/g;
    for (const match of source.matchAll(rawAlphaPattern)) {
      const line = lineTextAt(source, match.index);
      const isTokenDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
      if (isAuthorityFile && isTokenDeclaration) {
        continue;
      }
      const alpha = Number(match[1]);
      if (![1, 0.7, 0.45].includes(alpha)) {
        report(
          file,
          source,
          match.index,
          "Transparency must use only Figma opacity levels: 100%, 70%, or 45%.",
        );
      }
    }

    const rawColorMixTransparency = /color-mix\([^)]*?\s(\d+(?:\.\d+)?)%,\s*transparent\)/g;
    for (const match of source.matchAll(rawColorMixTransparency)) {
      const line = lineTextAt(source, match.index);
      const isTokenDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
      if (isAuthorityFile && isTokenDeclaration) {
        continue;
      }
      const percent = Number(match[1]);
      if (![100, 70, 45].includes(percent)) {
        report(
          file,
          source,
          match.index,
          "color-mix transparency must use a Figma transparency token (100%, 70%, or 45%).",
        );
      }
    }

    const cssDesignPatterns = [
      {
        pattern: /\bborder-radius\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--radius-") || value.startsWith("var(--card-radius"),
        message: "CSS border-radius must reference the canonical Figma radius token authority.",
      },
      {
        pattern: /\bopacity\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--opacity-"),
        message: "CSS opacity must reference the canonical Figma opacity token authority.",
      },
      {
        pattern: /\bfont-size\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.includes("var(--type-") || value.includes("var(--font-size-"),
        message: "CSS font-size must reference a canonical Figma typography token.",
      },
      {
        pattern: /\bline-height\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--type-") || value.startsWith("var(--line-height-"),
        message: "CSS line-height must reference a canonical Figma typography token.",
      },
      {
        pattern: /\bletter-spacing\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--type-") || value.startsWith("var(--letter-spacing-"),
        message: "CSS letter-spacing must reference a canonical Figma typography token.",
      },
      {
        pattern: /\bfont-weight\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--font-weight-"),
        message: "CSS font-weight must reference a canonical Figma typography token.",
      },
      {
        pattern: /\bfont-family\s*:\s*([^;]+);/g,
        allowedValue: (value) => value.startsWith("var(--font-family-"),
        message: "CSS font-family must reference the canonical Figma font-family authority.",
      },
    ];

    for (const match of source.matchAll(namedCssColorPattern)) {
      const line = lineTextAt(source, match.index);
      const isTokenDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
      if (!(isAuthorityFile && isTokenDeclaration) && !sourceException(source, match.index, "token")) {
        report(
          file,
          source,
          match.index,
          "Named CSS color literal outside the visual authority. Consume a canonical token instead.",
        );
      }
    }

    for (const match of source.matchAll(rawColorPattern)) {
      const line = lineTextAt(source, match.index);
      const isTokenDeclaration = /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
      if (
        !(isAuthorityFile && isTokenDeclaration) &&
        !sourceException(source, match.index, "token")
      ) {
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
        const isAuthorityDeclaration =
          isAuthorityFile && /^\s*--[a-zA-Z0-9_-]+\s*:/.test(line);
        const isFontFaceDescriptor = insideFontFaceBlock(source, match.index);
        if (
          !isAuthorityDeclaration &&
          !isFontFaceDescriptor &&
          !rule.allowedValue(value) &&
          !sourceException(source, match.index, "token")
        ) {
          report(file, source, match.index, rule.message);
        }
      }
    }
  }
}


async function checkFrontendArchiveBoundary() {
  const roots = [
    path.join(ROOT, "apps/frontend/src"),
    path.join(ROOT, "apps/backoffice/src"),
    path.join(ROOT, "packages/ui/src"),
  ];
  const importPattern =
    /(?:from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["'])/g;

  for (const root of roots) {
    for (const file of await walk(root)) {
      const rel = normalize(path.relative(ROOT, file));
      if (!/\.(?:ts|tsx|js|jsx)$/.test(rel) || /\.(?:test|spec)\.[^.]+$/.test(rel)) {
        continue;
      }
      const source = await fs.readFile(file, "utf8");
      for (const match of source.matchAll(importPattern)) {
        const specifier = String(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").replaceAll("\\", "/");
        if (/(^|\/)archive(?:\/|$)/.test(specifier)) {
          report(file, source, match.index,
            "Active production code must not import from the frontend archive. Archive code is reference-only.");
        }
      }
    }
  }
}

async function checkFrontendPyramid() {
  const frontendRoot = path.join(ROOT, "apps/frontend/src");
  const sourceFiles = (await walk(frontendRoot)).filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));

  const forbiddenAliasRoot = normalize(path.join("apps/frontend/src/components/ui"));
  const importPattern =
    /(?:from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["'])/g;

  for (const file of sourceFiles) {
    const rel = normalize(path.relative(ROOT, file));
    const source = await fs.readFile(file, "utf8");

    if (rel.startsWith(forbiddenAliasRoot + "/")) {
      report(
        file,
        source,
        0,
        "Alias-only app UI layers are forbidden. Generic primitives belong in @fitvibe/ui; app-specific behavior belongs in composites or domain components.",
      );
    }

    for (const match of source.matchAll(importPattern)) {
      const specifier = String(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").replaceAll("\\", "/");

      if (specifier.includes("/components/ui") || specifier.endsWith("/components/ui")) {
        report(
          file,
          source,
          match.index,
          "Do not import through an app-local UI alias. Import generic primitives from @fitvibe/ui or a real composite/domain component.",
        );
      }

      if (rel.includes("/components/composites/") && /(?:^|\/)pages(?:\/|$)/.test(specifier)) {
        report(
          file,
          source,
          match.index,
          "Composite components must not depend on pages. Pyramid direction is primitives -> composites -> sections/layouts -> pages.",
        );
      }

      if (rel.includes("/components/domain/") && /(?:^|\/)(?:pages|layouts|composites)(?:\/|$)/.test(specifier)) {
        report(
          file,
          source,
          match.index,
          "Domain components must stay below layouts/pages and may not depend upward on composites, layouts, or pages.",
        );
      }

      if (rel.includes("/layouts/") && /(?:^|\/)pages(?:\/|$)/.test(specifier)) {
        report(
          file,
          source,
          match.index,
          "Layouts must not import pages. Pages compose through routes/outlets, not upward imports.",
        );
      }
    }
  }

  const packageUiRoot = path.join(ROOT, "packages/ui/src");
  for (const file of await walk(packageUiRoot)) {
    if (!/\.(?:ts|tsx|js|jsx)$/.test(file)) continue;
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = String(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").replaceAll("\\", "/");
      if (specifier.includes("apps/frontend")) {
        report(
          file,
          source,
          match.index,
          "@fitvibe/ui is the base of the frontend pyramid and must never depend on the application layer.",
        );
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
  await checkFrontendArchiveBoundary();
  await checkFrontendPyramid();
  await checkFrontendReuse();
}

const count = violations.length - startCount;
if (count > 0) {
  console.error("Architecture & Hardcoding check failed with " + count + " violation(s).");
  process.exit(1);
}

console.log("Architecture & Hardcoding check passed: " + mode);
