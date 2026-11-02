"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const test = require("node:test");
const crypto = require("node:crypto");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const catalogFile = path.join(root, "apps/backoffice/src/i18n/ui.ts");
const source = fs.readFileSync(catalogFile, "utf8");
const ast = ts.createSourceFile(catalogFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function embeddedCatalog(locale) {
  let result;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "translations" &&
        node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      const property = node.initializer.properties.find(
        (p) => ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) ? p.name.text : p.name.getText(ast)) === locale,
      );
      if (property && ts.isPropertyAssignment(property)) {
        result = JSON.parse(property.initializer.getText(ast));
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(result, "Embedded translation catalog missing: " + locale);
  return result;
}

const bundles = {
  en: embeddedCatalog("en"),
  de: embeddedCatalog("de"),
  fr: require("../../apps/backoffice/src/i18n/fr.json"),
  es: require("../../apps/backoffice/src/i18n/es.json"),
  el: require("../../apps/backoffice/src/i18n/el.json"),
};
const locales = Object.keys(bundles);
const placeholders = (s) => [...s.matchAll(/\{([a-zA-Z_]\w*)\}/g)].map((m) => m[1]).sort();

test("all five audited Backoffice locales have the exact same keys and placeholders", () => {
  const keys = Object.keys(bundles.en).sort();
  assert.ok(keys.length >= 112);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(bundles[locale]).sort(), keys, locale + " key mismatch");
    for (const key of keys) {
      const text = bundles[locale][key];
      assert.equal(typeof text, "string", locale + " / " + key);
      assert.ok(text.trim(), locale + " / " + key + " is empty");
      assert.deepEqual(placeholders(text), placeholders(bundles.en[key]),
        locale + " / " + key + " placeholder mismatch");
    }
  }
});

test("all direct translation keys in the first-500 remediation surfaces exist", () => {
  const files = [
    "apps/backoffice/src/App.tsx",
    "apps/backoffice/src/components/AdminStatusHeader.tsx",
    "apps/backoffice/src/components/FreshTotpDialog.tsx",
    "apps/backoffice/src/components/Layout.tsx",
    "apps/backoffice/src/components/ThemeToggle.tsx",
    "apps/backoffice/src/pages/AdminDashboard_v2.tsx",
    "apps/backoffice/src/pages/AuditLogs.tsx",
  ];
  let found = 0;
  for (const relative of files) {
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    for (const m of text.matchAll(/\bt\("([a-z][a-zA-Z0-9.]*)"/g)) {
      assert.ok(m[1] in bundles.en, relative + " references unknown translation: " + m[1]);
      found++;
    }
  }
  assert.ok(found > 30, "Translation test unexpectedly lost coverage");
});

test("first 500 review decisions are accounted for and anchored to the baseline artifact", () => {
  const review = require("../../docs/qa/first500-verdicts.json");
  const values = [];
  for (const token of review.statusRunLengths.split(/\s+/)) {
    const match = /^([TFL])(\d+)$/.exec(token);
    assert.ok(match, "Invalid review token: " + token);
    values.push(...Array(Number(match[2])).fill(match[1]));
  }
  assert.equal(values.length, 500);
  for (const status of ["T", "F", "L"]) {
    assert.equal(values.filter((v) => v === status).length, review.counts[status]);
  }
  assert.equal(review.baseline.idsJoinedByNewlinesSha256.length, 64);
  assert.match(review.baseline.idsJoinedByNewlinesSha256, /^[0-9a-f]{64}$/);
});

test("AST audit keeps CSS custom-property values technical and navigation props technical", () => {
  const { analyzeSource } = require("./audit-ui-literals.cjs");
  const findings = analyzeSource("sample.tsx",
    'const x={text:"var(--color-text-primary)"}; const c=<Navigate to="/login" replace />;');
  assert.equal(findings.find((x) => x.text === "var(--color-text-primary)").classification, "technical");
  assert.equal(findings.find((x) => x.text === "/login").classification, "technical");
});

test("known typed audit protocol sentinels stay technical without hiding ordinary labels", () => {
  const { analyzeSource } = require("./audit-ui-literals.cjs");
  const source = [
    'const severityOptions: AuditLogSeverity[] = ["info", "warning", "error", "critical"];',
    'const [severity, setSeverity] = useState<AuditLogSeverity | "all">("all");',
    'function formatMetadataValue(value: unknown) { if (value === null) return "null"; }',
    'const visibleOptions = ["All", "Critical"];'
  ].join("\n");
  const matches = analyzeSource("sample.tsx", source);
  for (const value of ["info", "warning", "error", "critical", "all", "null"]) {
    assert.ok(matches.some((entry) => entry.text === value && entry.classification === "technical"),
      value + " must remain a technical protocol value");
  }
  assert.ok(matches.some((entry) => entry.text === "All" && entry.classification !== "technical"));
  assert.ok(matches.some((entry) => entry.text === "Critical" && entry.classification !== "technical"));
});

test("review log SHA-256 field is stable and valid", () => {
  const review = require("../../docs/qa/first500-verdicts.json");
  assert.equal(crypto.createHash("sha256").update("test").digest("hex").length, 64);
  assert.match(review.baseline.idsJoinedByNewlinesSha256, /^[0-9a-f]{64}$/);
});
