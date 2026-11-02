"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const bundles = {
  en: require("../../apps/backoffice/src/i18n/en.json"),
  de: require("../../apps/backoffice/src/i18n/de.json"),
  fr: require("../../apps/backoffice/src/i18n/fr.json"),
  es: require("../../apps/backoffice/src/i18n/es.json"),
  el: require("../../apps/backoffice/src/i18n/el.json"),
};
const locales = Object.keys(bundles);
const placeholders = (value) =>
  [...value.matchAll(/\{([a-zA-Z_]\w*)\}/g)].map((match) => match[1]).sort();

test("all five audited Backoffice locales have matching keys and placeholders", () => {
  const keys = Object.keys(bundles.en).sort();
  assert.equal(keys.length, 112);
  for (const locale of locales) {
    assert.deepEqual(Object.keys(bundles[locale]).sort(), keys, locale + " key mismatch");
    for (const key of keys) {
      const value = bundles[locale][key];
      assert.equal(typeof value, "string", locale + " / " + key);
      assert.ok(value.trim(), locale + " / " + key + " is empty");
      assert.deepEqual(
        placeholders(value),
        placeholders(bundles.en[key]),
        locale + " / " + key + " placeholder mismatch",
      );
    }
  }
});

test("every referenced translation key in the audited surfaces exists", () => {
  const files = [
    "apps/backoffice/src/App.tsx",
    "apps/backoffice/src/components/AdminStatusHeader.tsx",
    "apps/backoffice/src/components/FreshTotpDialog.tsx",
    "apps/backoffice/src/components/Layout.tsx",
    "apps/backoffice/src/components/ThemeToggle.tsx",
    "apps/backoffice/src/pages/AdminDashboard_v2.tsx",
    "apps/backoffice/src/pages/AuditLogs.tsx",
  ];
  let count = 0;
  for (const relative of files) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    for (const match of source.matchAll(/\bt\("([a-z][a-zA-Z0-9.]*)"/g)) {
      assert.ok(match[1] in bundles.en, relative + " references unknown key: " + match[1]);
      count++;
    }
  }
  assert.ok(count > 30, "Translation coverage unexpectedly reduced");
});

test("the 500 review verdicts match their documented baseline", () => {
  const review = require("../../docs/qa/first500-verdicts.json");
  const categories = [];
  for (const token of review.statusRunLengths.split(/\s+/)) {
    const match = /^([TFL])(\d+)$/.exec(token);
    assert.ok(match, "Invalid verdict token: " + token);
    categories.push(...Array(Number(match[2])).fill(match[1]));
  }
  assert.equal(categories.length, 500);
  for (const category of ["T", "F", "L"]) {
    assert.equal(categories.filter((value) => value === category).length, review.counts[category]);
  }
  assert.equal(
    review.baseline.idsJoinedByNewlinesSha256,
    "75531edac44999c5627f3f7c09bf887b62ea97028a648fa096da4830abbf1d39",
  );
});

test("CSS custom properties and router destinations are technical literals", () => {
  const { analyzeSource } = require("./audit-ui-literals.cjs");
  const findings = analyzeSource(
    "sample.tsx",
    'const colors = { text: "var(--color-text-primary)" }; const c = <Navigate to="/login" replace />;',
  );
  assert.equal(
    findings.find((finding) => finding.text === "var(--color-text-primary)").classification,
    "technical",
  );
  assert.equal(findings.find((finding) => finding.text === "/login").classification, "technical");
});

test("typed audit protocol values are technical but display labels remain visible candidates", () => {
  const { analyzeSource } = require("./audit-ui-literals.cjs");
  const input = [
    'const severityOptions: AuditLogSeverity[] = ["info", "warning", "error", "critical"];',
    'const [severity, setSeverity] = useState<AuditLogSeverity | "all">("all");',
    'function formatMetadataValue(value: unknown) { if (value === null) return "null"; }',
    'const visibleOptions = ["All", "Critical"];',
  ].join("\n");
  const findings = analyzeSource("sample.tsx", input);
  for (const value of ["info", "warning", "error", "critical", "all", "null"]) {
    assert.ok(
      findings.some((entry) => entry.text === value && entry.classification === "technical"),
      value + " should remain a technical protocol value",
    );
  }
  for (const label of ["All", "Critical"]) {
    assert.ok(findings.some((entry) => entry.text === label && entry.classification !== "technical"));
  }
});
