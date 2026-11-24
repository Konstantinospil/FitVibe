"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { scanRepository, analyzeSource } = require("./audit-ui-literals.cjs");

const root = path.resolve(__dirname, "../..");
const review = require("../../docs/qa/third500-verdicts.json");
const english = require("../../apps/backoffice/src/i18n/en.json");
const reviewed = [
  "apps/backoffice/src/pages/Messages.tsx",
  "apps/backoffice/src/pages/PrivilegeManagement.tsx",
  "apps/backoffice/src/pages/Settings.tsx",
  "apps/backoffice/src/pages/Translations.tsx",
];

function ids(encoded, expectedCount) {
  const bytes = Buffer.from(encoded, "base64");
  assert.equal(bytes.length, expectedCount * 8);
  const result = [];
  for (let i = 0; i < bytes.length; i += 8) {
    result.push(bytes.subarray(i, i + 8).toString("hex"));
  }
  assert.equal(new Set(result).size, result.length);
  return result;
}

test("the 1001–1500 verdicts are anchored to the original audit and classify every occurrence", () => {
  assert.equal(review.baseline.runId, 41533808821);
  assert.equal(review.baseline.idsJoinedByNewlinesSha256, "2d80a617d17784090b469bb6388041805bdfc2d59a5334989f393c6dd096d942");
  const codes = review.statusRunLengths.trim().split(/\s+/).flatMap((token) => {
    const match = /^([TFL])(\d+)$/.exec(token);
    assert.ok(match, "Invalid run-length verdict: " + token);
    return Array(Number(match[2])).fill(match[1]);
  });
  assert.equal(codes.length, 500);
  for (const code of ["T", "F", "L"]) {
    assert.equal(codes.filter((value) => value === code).length, review.counts[code]);
  }
  const localized = ids(review.localizedIds, review.counts.L);
  const falsePositives = ids(review.falsePositiveIds, review.counts.F);
  assert.equal(new Set([...localized, ...falsePositives]).size, localized.length + falsePositives.length);
});

test("third-batch original user-facing IDs are absent or now strictly technical", () => {
  const inventory = scanRepository(root);
  const current = new Map(inventory.findings.map((finding) => [finding.id, finding]));
  for (const file of reviewed) {
    assert.ok(inventory.findings.some((item) => item.file === file), file + " omitted by audit");
    const source = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of source.matchAll(/\bt\("([a-z][a-zA-Z0-9.]*)"/g)) {
      assert.ok(Object.hasOwn(english, match[1]), file + ": missing " + match[1]);
    }
  }
  for (const id of ids(review.localizedIds, review.counts.L)) {
    const finding = current.get(id);
    assert.ok(!finding || finding.classification === "technical", "UI still unresolved: " + id + " " + JSON.stringify(finding));
  }
  for (const id of ids(review.falsePositiveIds, review.counts.F)) {
    const finding = current.get(id);
    assert.ok(!finding || finding.classification === "technical", "False positive still misclassified: " + id + " " + JSON.stringify(finding));
  }
});

test("role codes and translation identifiers stay technical while privileged UI labels are detected", () => {
  const samples = [
    'const nextRole = selected.role === "admin" ? "superadmin" : "admin";',
    'const displayLanguage = (activeByLanguage.has("en") && "en") || deletedByLanguage.get("en");',
    'const key = `${trans.namespace}::${trans.key_path}`;',
    'const aKey = `${a.namespace}.${a.key_path}`;',
    'const bKey = `${b.namespace}.${b.key_path}`;',
    'const visible = <Button>Promote</Button>;',
  ].join("\n");
  const findings = analyzeSource("sample.tsx", samples);
  for (const word of ["admin", "superadmin"]) {
    assert.ok(findings.some((finding) => finding.text === word && finding.classification === "technical"), word);
  }
  assert.ok(findings.some((finding) => finding.text === "Promote" && finding.classification === "ui"));
  for (const key of ["${expression}::${expression}", "${expression}.${expression}"]) {
    assert.ok(findings.some((finding) => finding.text === key && finding.classification === "technical"), key);
  }
});
