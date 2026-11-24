"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const test = require("node:test");
const { scanRepository, analyzeSource } = require("./audit-ui-literals.cjs");

const root = path.resolve(__dirname, "../..");
const baseline = require("../../docs/qa/second500-baseline-id-sets.json");
const en = require("../../apps/backoffice/src/i18n/en.json");
const paths = [
  "apps/backoffice/src/pages/AuditLogs.tsx",
  "apps/backoffice/src/pages/ContentReports_v2.tsx",
  "apps/backoffice/src/pages/LegalPublications.tsx",
  "apps/backoffice/src/pages/Login.tsx",
  "apps/backoffice/src/pages/Messages.tsx",
];

function decodeIds(base64, expected) {
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.length, expected * 8);
  const ids = [];
  for (let offset = 0; offset < bytes.length; offset += 8) {
    ids.push(bytes.subarray(offset, offset + 8).toString("hex"));
  }
  assert.equal(new Set(ids).size, expected);
  return ids;
}

test("second 500 immutable baseline is complete and has no overlapping verdict IDs", () => {
  assert.equal(baseline.baseline.runId, 41533808821);
  assert.equal(
    baseline.baseline.idsJoinedByNewlinesSha256,
    "9ea6a99d356cfd58c39ea5c930de6871ceaa74a0dba6fc813e75995459e2c772",
  );
  assert.equal(Object.values(baseline.counts).reduce((a, b) => a + b, 0), 500);
  const localized = decodeIds(baseline.localizedIds, baseline.counts.L);
  const falsePositives = decodeIds(baseline.falsePositiveIds, baseline.counts.F);
  assert.equal(new Set([...localized, ...falsePositives]).size, localized.length + falsePositives.length);
});

test("second-batch localized source literals no longer appear as untranslated UI", () => {
  const report = scanRepository(root);
  const current = new Map(report.findings.map((finding) => [finding.id, finding]));
  for (const relative of paths) {
    assert.ok(report.findings.some((item) => item.file === relative), "Missing audit input " + relative);
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    for (const match of source.matchAll(/\bt\("([a-z][a-zA-Z0-9.]*)"/g)) {
      assert.ok(Object.hasOwn(en, match[1]), relative + ": missing translation " + match[1]);
    }
  }
  for (const id of decodeIds(baseline.localizedIds, baseline.counts.L)) {
    const finding = current.get(id);
    // Stable IDs are occurrence-based: removing a rendered use of a repeated
    // literal can transfer its original ID to a later technical protocol use.
    // Such a surviving ID is acceptable only when the AST now proves it technical.
    assert.ok(
      !finding || finding.classification === "technical",
      "Previously untranslated literal remains visible/reviewable: " + id,
    );
  }
  for (const id of decodeIds(baseline.falsePositiveIds, baseline.counts.F)) {
    const finding = current.get(id);
    if (finding) {
      assert.equal(finding.classification, "technical", "False positive reintroduced: " + id);
    }
  }
});

test("known technical enum options stay technical while adjacent visible labels remain detectable", () => {
  const source = [
    'const filters = (["all", "pending", "reviewed", "dismissed"] as const).map((status) => status);',
    'const [filterStatus] = useState<"all" | "pending" | "reviewed" | "dismissed">("pending");',
    'const ACTIONS_BY_DOCUMENT: Record<LegalDocumentType, LegalUserAction[]> = {terms:["accept"]};',
    'const [documentType] = useState<LegalDocumentType>("terms");',
    'const mailtoLink = `mailto:${email}?subject=${subject}${body ? `&body=${body}` : ""}`;',
    'const labels = ["Hide", "Pending"];',
  ].join("\n");
  const findings = analyzeSource("sample.tsx", source);
  for (const value of ["all", "pending", "reviewed", "dismissed", "accept", "terms"]) {
    assert.ok(findings.some((entry) => entry.text === value && entry.classification === "technical"), value);
  }
  for (const value of ["Hide", "Pending"]) {
    assert.ok(findings.some((entry) => entry.text === value && entry.classification !== "technical"), value);
  }
  assert.ok(findings.some((entry) => entry.text.startsWith("mailto:") && entry.classification === "technical"));
  assert.ok(findings.some((entry) => entry.text.startsWith("&body=") && entry.classification === "technical"));
});
