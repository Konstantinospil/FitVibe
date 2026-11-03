"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { analyzeSource, analyzeHtml, analyzeCss, markdownReport } = require("./audit-ui-literals.cjs");

function find(source, literal, extension = ".tsx") {
  return analyzeSource("fixture" + extension, source).find((item) => item.text === literal);
}

test("captures JSX text, short labels, accessibility attributes and expressions", () => {
  assert.equal(find("<button>Save</button>", "Save")?.classification, "ui");
  assert.equal(find('<button aria-label="Delete record">Cancel</button>', "Delete record")?.classification, "ui");
  assert.equal(find('<div title={"Search"} />', "Search")?.classification, "ui");
  assert.equal(find('<p>{"Loading..."}</p>', "Loading...")?.classification, "ui");
});

test("captures UI configuration and notifications", () => {
  assert.equal(find('const options = { title: "Users" };', "Users", ".ts")?.classification, "ui");
  assert.equal(find('alert("Password reset sent")', "Password reset sent", ".ts")?.classification, "ui");
  assert.equal(find('const rows = [["all", "All users"]]', "All users", ".ts")?.classification, "review");
  assert.equal(find('confirm(\`Delete ${user}?\`)', "Delete ${expression}?", ".ts")?.classification, "ui");
});

test("does not misidentify translation keys, imports or CSS classes", () => {
  assert.equal(find('import x from "./x";', "./x", ".ts")?.classification, "technical");
  assert.equal(find('<p>{t("settings.title")}</p>', "settings.title")?.classification, "technical");
  assert.equal(find('<div className="p-2" />', "p-2")?.classification, "technical");
  assert.equal(find('<button title={t("save")}>Save</button>', "save")?.classification, "technical");
});

test("semantic ARIA values and SVG geometry are not translated", () => {
  const source = '<><svg viewBox="0 0 60 40"><path d="M 0 0" strokeWidth="2" /></svg><span aria-hidden="true" aria-live="polite" aria-label="Notifications" /></>';
  const results = analyzeSource("fixture.tsx", source);
  for (const value of ["0 0 60 40", "M 0 0", "2", "true", "polite"]) {
    assert.ok(results.some((item) => item.text === value && item.classification === "technical"), value);
  }
  assert.equal(results.find((item) => item.text === "Notifications").classification, "ui");
});

test("CSS colors and toast level enums are not UI prose", () => {
  const results = analyzeSource("fixture.tsx", 'const c="#C8102E"; showToast("success", "Profile saved");');
  assert.equal(results.find((item) => item.text === "#C8102E").classification, "technical");
  assert.equal(results.find((item) => item.text === "success").classification, "technical");
  assert.equal(results.find((item) => item.text === "Profile saved").classification, "ui");
});

test("never discards ambiguous literals", () => {
  assert.equal(find('const roleLabel = "Superadministrator"', "Superadministrator", ".ts")?.classification, "review");
});

test("records React.createElement children and template expressions", () => {
  assert.equal(find('React.createElement("h1", {}, "Welcome")', "Welcome", ".ts")?.classification, "ui");
  assert.equal(find('toast.error(\`Failed for ${name}\`)', "Failed for ${expression}", ".ts")?.classification, "ui");
});

test("includes static HTML and CSS-generated content", () => {
  assert.equal(analyzeHtml('<h1>Hello</h1>', "index.html")[0]?.text, "Hello");
  assert.equal(analyzeCss('p:before { content: "New"; }', "theme.css")[0]?.text, "New");
});

test("parse failures fail closed, reports are escaped", () => {
  assert.throws(() => analyzeSource("broken.tsx", "<div>oops</span>"), /parse failed/);
  const report = { filesScanned: 1, total: 1, counts: { ui: 1, review: 0, technical: 0 },
    findings: [{ classification: "ui", file: "a.tsx", line: 1, reason: "jsx-text", text: "A | B" }] };
  assert.match(markdownReport(report), /A \\\| B/);
});
