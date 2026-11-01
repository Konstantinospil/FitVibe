#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const EXCEPTIONS_DIR = path.resolve(process.cwd(), "infra/security/exceptions");
const EXCEPTION_NAME = /^EX-(\d{4})-(\d{4})\.json$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EXPIRY_DAYS = 90;

function readDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be an ISO UTC date (YYYY-MM-DD)`);
  }
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} is not a valid UTC date`);
  }
  return ms;
}

function required(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a nonempty string`);
  }
}

function validateException(name, data, now = Date.now()) {
  if (!EXCEPTION_NAME.test(name)) {
    throw new Error("Exception name must use EX-YYYY-####.json");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Exception record must be a JSON object");
  }
  if (data.id !== name.replace(/\.json$/, "")) {
    throw new Error("Exception ID must match its filename");
  }
  for (const key of ["owner", "securityApprover", "asset", "justification", "riskContext", "cvssContext", "remediationIssue"]) {
    required(data[key], key);
  }
  if (data.approval !== "approved") {
    throw new Error("Exception must have explicit security approval");
  }
  if (!Array.isArray(data.compensatingControls) ||
    data.compensatingControls.length === 0 ||
    data.compensatingControls.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("At least one compensating control must be documented");
  }
  const submitted = readDate(data.submittedAt, "submittedAt");
  const approved = readDate(data.approvedAt, "approvedAt");
  const expires = readDate(data.expiresAt, "expiresAt");
  if (approved < submitted || expires < approved || expires - approved > MAX_EXPIRY_DAYS * DAY_MS) {
    throw new Error("Exception dates exceed the approved 90-day window");
  }
  if (expires + DAY_MS <= now) {
    throw new Error("Exception has expired; remove or renew with fresh security approval");
  }
}

function main() {
  const files = fs.readdirSync(EXCEPTIONS_DIR).filter((name) => name.startsWith("EX-"));
  for (const name of files) {
    if (!EXCEPTION_NAME.test(name)) {
      throw new Error(`${name}: use machine-readable EX-YYYY-####.json, not unvalidated exceptions`);
    }
    try {
      validateException(name, JSON.parse(fs.readFileSync(path.join(EXCEPTIONS_DIR, name), "utf8")));
    } catch (error) {
      throw new Error(`${name}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`Security-policy exception expiry verified (${files.length} active records).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { validateException, readDate };
