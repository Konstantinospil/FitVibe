const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateException } = require("./check-policy-exceptions.cjs");

const name = "EX-2026-0001.json";
const today = Date.parse("2026-11-01T12:00:00.000Z");
const valid = {
  id: "EX-2026-0001",
  owner: "test-owner",
  securityApprover: "test-reviewer",
  approval: "approved",
  asset: "example-service",
  justification: "Temporary compatibility exception",
  riskContext: "Controlled fixture only",
  cvssContext: "Not applicable; no CVE",
  remediationIssue: "https://example.invalid/issues/1",
  compensatingControls: ["Limit network access", "Monitor events"],
  submittedAt: "2026-10-01",
  approvedAt: "2026-10-01",
  expiresAt: "2026-12-01",
};

test("approved bounded exception passes", () => {
  assert.doesNotThrow(() => validateException(name, valid, today));
});

test("unapproved exception is rejected", () => {
  assert.throws(() => validateException(name, { ...valid, approval: "pending" }, today), /approval/);
});

test("expired exception is rejected", () => {
  assert.throws(() => validateException(name, { ...valid, expiresAt: "2026-10-31" }, today), /expired/);
});

test("expiry above 90 days is rejected", () => {
  assert.throws(
    () => validateException(name, { ...valid, expiresAt: "2027-02-01" }, today),
    /90-day/,
  );
});

test("an empty control or reviewer is rejected", () => {
  assert.throws(() => validateException(name, { ...valid, compensatingControls: [] }, today), /control/);
  assert.throws(() => validateException(name, { ...valid, securityApprover: "" }, today), /securityApprover/);
});

test("ID and filename must match", () => {
  assert.throws(() => validateException(name, { ...valid, id: "EX-2026-0002" }, today), /match/);
});

test("date parser rejects impossible dates and non-UTC formats", () => {
  assert.throws(() => validateException(name, { ...valid, approvedAt: "2026-02-30" }, today), /valid UTC/);
  assert.throws(() => validateException(name, { ...valid, submittedAt: "01-10-2026" }, today), /ISO UTC/);
});
