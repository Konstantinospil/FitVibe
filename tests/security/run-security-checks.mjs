#!/usr/bin/env node
/* eslint-disable no-console */
import { execSync } from "node:child_process";
import process from "node:process";

// SECURITY: Whitelist allowed commands to prevent command injection
// Never execute commands constructed from environment variables directly
const ALLOWED_COMMANDS = ["pnpm", "corepack pnpm", "npx", "node"];

function sanitizeCommand(cmd) {
  const trimmed = cmd.trim();

  // Extract the first token (handles quoted paths on Windows)
  // Example: '"C:\Program Files\nodejs\node.exe" script.js' -> 'C:\Program Files\nodejs\node.exe'
  let firstToken = "";

  // Handle quoted strings first (preserves paths with spaces)
  if (trimmed.startsWith('"')) {
    const endQuote = trimmed.indexOf('"', 1);
    if (endQuote !== -1) {
      firstToken = trimmed.substring(1, endQuote); // Extract without quotes
    } else {
      // Malformed quote, fallback to first word
      firstToken = trimmed.split(/\s+/)[0].replace(/^["']|["']$/g, "");
    }
  } else if (trimmed.startsWith("'")) {
    const endQuote = trimmed.indexOf("'", 1);
    // codeql[js/shell-command-built-from-env] - Command is sanitized via whitelist check before execution
    if (endQuote !== -1) {
      firstToken = trimmed.substring(1, endQuote); // Extract without quotes
    } else {
      // Malformed quote, fallback to first word
      firstToken = trimmed.split(/\s+/)[0].replace(/^["']|["']$/g, "");
    }
  } else {
    // Not quoted, split by space
    firstToken = trimmed.split(/\s+/)[0];
  }

  // Extract executable name from path (handles both Unix and Windows paths)
  // Example: 'C:\Program Files\nodejs\node.exe' -> 'node'
  // Example: '/usr/bin/node' -> 'node'
  const executableName =
    firstToken
      .split(/[/\\]/)
      .pop()
      ?.replace(/\.exe$/i, "") || firstToken;

  // SECURITY: Check for multi-word commands first, then single-word commands
  // This ensures "corepack pnpm" is matched before "corepack" alone
  const isAllowed = ALLOWED_COMMANDS.some((allowed) => {
    // Check if command starts with allowed command (exact match)
    if (trimmed === allowed) {
      return true;
    }
    // Check if command starts with allowed command followed by space
    // This handles "corepack pnpm audit" matching "corepack pnpm"
    if (trimmed.startsWith(allowed + " ")) {
      return true;
    }
    // For single-word commands, check if executable name matches
    // This handles "node script.js", "/usr/bin/node script.js", or "C:\Program Files\nodejs\node.exe script.js"
    if (allowed.indexOf(" ") === -1) {
      // Check if executable name matches the allowed command
      if (executableName === allowed) {
        // If executable name matches, the command is allowed
        // Additional arguments after the executable are valid
        return true;
      }
      // Also check if firstToken exactly matches (for unquoted simple commands)
      if (firstToken === allowed) {
        const afterToken = trimmed.substring(firstToken.length).trim();
        const nextChar = afterToken[0];
        return nextChar === undefined || nextChar === " " || nextChar === "/" || nextChar === "\\";
      }
    }
    return false;
  });

  if (!isAllowed) {
    throw new Error(
      `Command not allowed: ${executableName}. Only whitelisted commands are permitted.`,
    );
  }

  return cmd;
}

const pnpmCmd = process.platform === "win32" ? "corepack pnpm" : "pnpm";

// Quote node path for Windows (handles spaces in path like "C:\Program Files\...")
const nodePath =
  process.platform === "win32" && process.execPath.includes(" ")
    ? `"${process.execPath}"`
    : process.execPath;

// SECURITY: Define commands statically (not from environment)
const commands = [
  {
    title: "Authentication policy exception expiry",
    command: `${nodePath} tests/security/check-policy-exceptions.cjs`,
  },
  {
    title: "Authentication policy exception validator regressions",
    command: `${nodePath} --test tests/security/check-policy-exceptions.test.cjs`,
  },
  {
    title: "Dependency audit (pnpm)",
    command: `${pnpmCmd} audit --prod --audit-level=high`,
  },
  {
    title: "Static secret scan",
    command: `${nodePath} tests/security/secret-scan.cjs`,
  },
];

function runCommand(title, command, options = {}) {
  console.log(`\n▶ ${title}`);
  console.log(`$ ${command}`);

  // SECURITY: Sanitize command before execution
  const sanitized = sanitizeCommand(command);

  execSync(sanitized, {
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    shell: true,
  });
}

try {
  for (const job of commands) {
    runCommand(job.title, job.command, job.options ?? {});
  }

  if (process.env.SNYK_TOKEN) {
    runCommand("Snyk scan", "npx --yes snyk test --severity-threshold=high", {
      env: { SNYK_TOKEN: process.env.SNYK_TOKEN },
    });
  } else {
    console.log("⚠️  Skipping Snyk scan because SNYK_TOKEN is not set.");
  }

  console.log("\n✅ Security checks completed successfully.");
} catch (error) {
  console.error("\nSecurity checks failed.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
