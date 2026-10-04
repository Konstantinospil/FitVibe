#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
  ".json",
  ".html",
  ".css",
  ".yml",
  ".yaml",
  ".md",
  ".txt",
  ".env",
  "",
]);

const IGNORE_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
  ".lighthouseci",
]);

const IGNORE_DIR_PATHS = new Set([
  path.join("tests", "qa", "summary"),
  path.join("tests", "perf", "lhci-output"),
  path.join("apps", "docs"),
  path.join("docs"),
  ".claude",
]);

const SECRET_PATTERNS = [
  { id: "AWS Access Key", regex: /\b(A3T[A-Z0-9]{16}|AKIA[0-9A-Z]{16})\b/g },
  {
    id: "AWS Secret Key",
    regex: /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*=\s*[A-Za-z0-9/+=]{40}/g,
  },
  { id: "GitHub Token", regex: /\bgh[pousr]_[0-9A-Za-z]{36}\b/g },
  { id: "Google API Key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { id: "Slack Token", regex: /\bxox[baprs]-[0-9A-Za-z]{10,48}\b/g },
  { id: "Stripe Secret", regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
  { id: "Private Key", regex: /-----BEGIN (?:RSA|EC)? ?PRIVATE KEY-----/g },
];

const findings = [];
const repoRoot = process.cwd();
const explicitScanRoot = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : null;
const scanRoot = explicitScanRoot ?? repoRoot;

function shouldSkip(entryPath, stats) {
  if (stats.isDirectory()) {
    const dirName = path.basename(entryPath);
    if (IGNORE_DIR_NAMES.has(dirName)) {
      return true;
    }
    const relative = path.relative(repoRoot, entryPath);
    if (IGNORE_DIR_PATHS.has(relative)) {
      return true;
    }
    return false;
  }
  const ext = path.extname(entryPath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return true;
  }
  if (stats.size > MAX_FILE_BYTES) {
    return true;
  }
  return false;
}

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  if (content.includes("\u0000")) {
    return; // binary
  }

  for (const pattern of SECRET_PATTERNS) {
    const matches = [...content.matchAll(pattern.regex)];
    if (matches.length === 0) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (const match of matches) {
      const matchText = match[0];
      let lineNumber = 1;
      let totalChars = 0;
      for (const line of lines) {
        totalChars += line.length + 1;
        if (totalChars > match.index) {
          break;
        }
        lineNumber += 1;
      }

      const lineText = lines[lineNumber - 1] ?? "";
      const trimmedLine = lineText.trim();
      // Skip comments and documentation examples
      if (
        trimmedLine.startsWith("#") ||
        trimmedLine.includes("...") ||
        trimmedLine.startsWith("//") ||
        trimmedLine.startsWith("*") ||
        filePath.includes("docs/") ||
        filePath.includes(".md")
      ) {
        continue;
      }

      const snippet =
        matchText.length > 12 ? `${matchText.slice(0, 6)}…${matchText.slice(-4)}` : matchText;

      findings.push({
        file: filePath,
        line: lineNumber,
        pattern: pattern.id,
        snippet,
      });
    }
  }
}

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    let stats;
    try {
      stats = fs.statSync(entryPath);
    } catch {
      continue;
    }

    if (shouldSkip(entryPath, stats)) {
      continue;
    }

    if (stats.isDirectory()) {
      walk(entryPath);
    } else if (stats.isFile()) {
      scanFile(entryPath);
    }
  }
}

if (!fs.existsSync(scanRoot)) {
  console.error(`Secret scan root does not exist: ${path.relative(repoRoot, scanRoot)}`);
  process.exit(1);
}

walk(scanRoot);

if (findings.length > 0) {
  console.error("Potential secrets detected:");
  for (const finding of findings.slice(0, 20)) {
    console.error(`- ${finding.pattern} in ${finding.file}:${finding.line} (${finding.snippet})`);
  }
  if (findings.length > 20) {
    console.error(`…and ${findings.length - 20} more findings`);
  }
  process.exit(1);
}

console.log(`Secret scan completed for ${path.relative(repoRoot, scanRoot) || "."} — no patterns detected.`);
