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


test("native SVG geometry and ARIA state are technical, accessible labels remain UI", () => {
  assert.equal(find('<svg viewBox="0 0 100 100"><path d="M0 0 L1 1" /></svg>', "0 0 100 100")?.classification, "technical");
  assert.equal(find('<svg><path d="M0 0 L1 1" /></svg>', "M0 0 L1 1")?.classification, "technical");
  assert.equal(find('<div aria-hidden="true" />', "true")?.classification, "technical");
  assert.equal(find('<div aria-live="polite" />', "polite")?.classification, "technical");
  assert.equal(find('<button aria-label="Delete user">Delete</button>', "Delete user")?.classification, "ui");
  assert.equal(find('<CustomWidget label="Review results" />', "Review results")?.classification, "ui");
});

test("literal English translation defaultValue is detected, but a translation key is technical", () => {
  const source = 'const copy = t("auth.login.submit", { defaultValue: "Sign in now" });';
  assert.equal(find(source, "auth.login.submit", ".ts")?.classification, "technical");
  const fallback = find(source, "Sign in now", ".ts");
  assert.equal(fallback?.classification, "ui");
  assert.equal(fallback?.reason, "hardcoded-translation-fallback");
});


test("nested JSX handler literals are not mistaken for displayed copy", () => {
  const expression = '<div>{users.map(user => { const url = "/users/avatar/"; return <img src={url} alt={user.name} />; })}</div>';
  const found = find(expression, "/users/avatar/");
  assert.notEqual(found?.classification, "ui");
  assert.equal(find('<p>{"Read more"}</p>', "Read more")?.classification, "ui");
  assert.equal(find('<span>{ready ? "Ready" : "Working"}</span>', "Ready")?.classification, "ui");
});

test("nonlinguistic template joins are technical but actual text remains UI", () => {
  assert.equal(find('<div aria-label={`\${date} — \${label}`} />', "${expression} — ${expression}")?.classification, "technical");
  assert.equal(find('<div aria-label={`Welcome \${name}`} />', "Welcome ${expression}")?.classification, "ui");
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
