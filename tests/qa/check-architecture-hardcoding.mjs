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
  }

  for (const file of stylesheetFiles) {
    const source = await fs.readFile(file, "utf8");
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
